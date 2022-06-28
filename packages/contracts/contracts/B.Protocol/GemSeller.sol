// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./../StabilityPool.sol";
import "./PriceFormula.sol";
import "./../Interfaces/IPriceFeed.sol";
import "./../Dependencies/IERC20.sol";
import "./../Dependencies/SafeMath.sol";
import "./../Dependencies/Ownable.sol";
import "./../Dependencies/AggregatorV3Interface.sol";

interface IGemOwner {
    function compound(uint lusdAmount) external;
}

contract GemSeller is PriceFormula, Ownable {
    using SafeMath for uint256;

    AggregatorV3Interface public immutable gem2ethPriceAggregator;
    AggregatorV3Interface public immutable eth2usdPriceAggregator;
    AggregatorV3Interface public immutable lusd2UsdPriceAggregator;   
    IERC20 public immutable LUSD;
    IERC20 public immutable gem;
    address public immutable gemOwner;
    uint public immutable lusdVirtualBalance;
    address public immutable feePool;

    uint public constant MAX_FEE = 100; // 1%
    uint public fee = 0; // fee in bps
    uint public A = 20;
    uint public constant MIN_A = 20;
    uint public constant MAX_A = 200;    

    uint public immutable maxDiscount; // max discount in bips

    uint constant public PRECISION = 1e18;

    event ParamsSet(uint A, uint fee);
    event RebalanceSwap(address indexed user, uint lusdAmount, uint gemAmount, uint timestamp);

    constructor(
        AggregatorV3Interface _gem2ethPriceAggregator,
        AggregatorV3Interface _eth2usdPriceAggregator,
        AggregatorV3Interface _lusd2UsdPriceAggregator,
        IERC20 _LUSD,
        IERC20 _gem,
        address _gemOwner,
        uint _lusdVirtualBalance,
        uint _maxDiscount,
        address _feePool
    )
        public 
    {
        gem2ethPriceAggregator = _gem2ethPriceAggregator;
        eth2usdPriceAggregator = _eth2usdPriceAggregator;
        lusd2UsdPriceAggregator = _lusd2UsdPriceAggregator;
        LUSD = _LUSD;
        gem = _gem;
        gemOwner = _gemOwner;
        lusdVirtualBalance = _lusdVirtualBalance;
        feePool = _feePool;
        maxDiscount = _maxDiscount;

        require(_gem.decimals() == 18 && _LUSD.decimals() == 18, "only 18 decimals are supported");
    }

    function setParams(uint _A, uint _fee) external onlyOwner {
        require(_fee <= MAX_FEE, "setParams: fee is too big");
        require(_A >= MIN_A, "setParams: A too small");
        require(_A <= MAX_A, "setParams: A too big");

        fee = _fee;
        A = _A;

        emit ParamsSet(_A, _fee);
    }

    function fetchPrice(AggregatorV3Interface feed) public view returns(uint) {
        uint chainlinkDecimals;
        uint chainlinkLatestAnswer;
        uint chainlinkTimestamp;

        // First, try to get current decimal precision:
        try feed.decimals() returns (uint8 decimals) {
            // If call to Chainlink succeeds, record the current decimal precision
            chainlinkDecimals = decimals;
        } catch {
            // If call to Chainlink aggregator reverts, return a zero response with success = false
            return 0;
        }

        // Secondly, try to get latest price data:
        try feed.latestRoundData() returns
        (
            uint80 /* roundId */,
            int256 answer,
            uint256 /* startedAt */,
            uint256 timestamp,
            uint80 /* answeredInRound */
        )
        {
            // If call to Chainlink succeeds, return the response and success = true
            chainlinkLatestAnswer = uint(answer);
            chainlinkTimestamp = timestamp;
        } catch {
            // If call to Chainlink aggregator reverts, return a zero response with success = false
            return 0;
        }

        if(chainlinkTimestamp + 1 hours < now) return 0; // price is down

        uint chainlinkFactor = 10 ** chainlinkDecimals;
        return chainlinkLatestAnswer.mul(PRECISION) / chainlinkFactor;
    }

    function fetchGem2EthPrice() public view returns(uint) {
        return fetchPrice(gem2ethPriceAggregator);
    }

    function fetchEthPrice() public view returns(uint) {
        return fetchPrice(eth2usdPriceAggregator);
    }

    function addBps(uint n, int bps) internal pure returns(uint) {
        require(bps <= 10000, "reduceBps: bps exceeds max");
        require(bps >= -10000, "reduceBps: bps exceeds min");

        return n.mul(uint(10000 + bps)) / 10000;
    }

    function compensateForLusdDeviation(uint gemAmount) public view returns(uint newGemAmount) {
        uint chainlinkDecimals;
        uint chainlinkLatestAnswer;

        // get current decimal precision:
        chainlinkDecimals = lusd2UsdPriceAggregator.decimals();

        // Secondly, try to get latest price data:
        (,int256 answer,,,) = lusd2UsdPriceAggregator.latestRoundData();
        chainlinkLatestAnswer = uint(answer);

        // adjust only if 1 LUSD > 1 USDC. If LUSD < USD, then we give a discount, and rebalance will happen anw
        if(chainlinkLatestAnswer > 10 ** chainlinkDecimals ) {
            newGemAmount = gemAmount.mul(chainlinkLatestAnswer) / (10 ** chainlinkDecimals);
        }
        else newGemAmount = gemAmount;
    }

    function gemToLUSD(uint gemQty, uint gem2EthPrice, uint eth2UsdPrice) public pure returns(uint) {
        return gemQty.mul(gem2EthPrice).div(PRECISION).mul(eth2UsdPrice).div(PRECISION);
    }

    function LUSDToGem(uint lusdQty, uint gem2EthPrice, uint eth2UsdPrice) public pure returns(uint) {
        return lusdQty.mul(PRECISION).div(gem2EthPrice).mul(PRECISION).div(eth2UsdPrice);
    }    

    function getSwapGemAmount(uint lusdQty) public view returns(uint gemAmount, uint feeLusdAmount) {
        uint gemBalance  = gem.balanceOf(gemOwner);

        uint eth2usdPrice = fetchEthPrice();
        uint gem2ethPrice = fetchGem2EthPrice();
        if(eth2usdPrice == 0 || gem2ethPrice == 0) return (0, 0); // feed is down

        uint gemUsdValue = gemToLUSD(gemBalance, gem2ethPrice, eth2usdPrice);
        uint maxReturn = addBps(LUSDToGem(lusdQty, gem2ethPrice, eth2usdPrice), int(maxDiscount));

        uint xQty = lusdQty;
        uint xBalance = lusdVirtualBalance;
        uint yBalance = lusdVirtualBalance.add(gemUsdValue.mul(2));
        
        uint usdReturn = getReturn(xQty, xBalance, yBalance, A);
        uint basicGemReturn = LUSDToGem(usdReturn, gem2ethPrice, eth2usdPrice);

        basicGemReturn = compensateForLusdDeviation(basicGemReturn);

        if(gemBalance < basicGemReturn) basicGemReturn = gemBalance; // cannot give more than balance 
        if(maxReturn < basicGemReturn) basicGemReturn = maxReturn;

        gemAmount = basicGemReturn;
        feeLusdAmount = addBps(lusdQty, int(fee)).sub(lusdQty);
    }

    // get gem in return to LUSD
    function swap(uint lusdAmount, uint minGemReturn, address payable dest) public returns(uint) {
        (uint gemAmount, uint feeAmount) = getSwapGemAmount(lusdAmount);

        require(gemAmount >= minGemReturn, "swap: low return");

        // transfer to gem owner and deposit lusd into the stability pool
        require(LUSD.transferFrom(msg.sender, gemOwner, lusdAmount.sub(feeAmount)), "swap: LUSD transfer failed");
        IGemOwner(gemOwner).compound(lusdAmount.sub(feeAmount));

        // transfer fees to fee pool
        if(feeAmount > 0) require(LUSD.transferFrom(msg.sender, feePool, feeAmount), "swap: LUSD fee transfer failed");

        // send gem return to buyer
        require(gem.transferFrom(gemOwner, dest, gemAmount), "swap: LQTY transfer failed");

        emit RebalanceSwap(msg.sender, lusdAmount, gemAmount, now);

        return gemAmount;
    }

    // kyber network reserve compatible function
    function trade(
        IERC20 /* srcToken */,
        uint256 srcAmount,
        IERC20 /* destToken */,
        address payable destAddress,
        uint256 /* conversionRate */,
        bool /* validate */
    ) external payable returns (bool) {
        return swap(srcAmount, 0, destAddress) > 0;
    }

    function getConversionRate(
        IERC20 /* src */,
        IERC20 /* dest */,
        uint256 srcQty,
        uint256 /* blockNumber */
    ) external view returns (uint256) {
        (uint gemQty, ) = getSwapGemAmount(srcQty);
        return gemQty.mul(PRECISION) / srcQty;
    }

    receive() external payable {}
}
