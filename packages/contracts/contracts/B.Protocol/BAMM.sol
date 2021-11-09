// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./TokenAdapter.sol";
import "./PriceFormula.sol";
import "./../Interfaces/IPriceFeed.sol";
import "./../Dependencies/IERC20.sol";
import "./../Dependencies/SafeMath.sol";
import "./../Dependencies/Ownable.sol";
import "./../Dependencies/AggregatorV3Interface.sol";


interface ICToken {
    function redeem(uint redeemTokens) external returns (uint);
    function balanceOf(address a) external view returns (uint);
    function liquidateBorrow(address borrower, uint amount, address collateral) external returns (uint);
}

contract BAMM is TokenAdapter, PriceFormula, Ownable {
    using SafeMath for uint256;

    AggregatorV3Interface public immutable priceAggregator;
    IERC20 public immutable LUSD;
    uint public immutable lusdDecimals;
    ICToken public immutable cETH;
    ICToken public immutable cBorrow;

    address payable public immutable feePool;
    uint public constant MAX_FEE = 100; // 1%
    uint public constant MAX_CALLER_FEE = 100; // 1%
    uint public fee = 0; // fee in bps
    uint public callerFee = 0; // fee in bps
    uint public A = 20;
    uint public constant MIN_A = 20;
    uint public constant MAX_A = 200;    

    uint public immutable maxDiscount; // max discount in bips

    uint constant public PRECISION = 1e18;

    event ParamsSet(uint A, uint fee, uint callerFee);
    event UserDeposit(address indexed user, uint lusdAmount, uint numShares);
    event UserWithdraw(address indexed user, uint lusdAmount, uint ethAmount, uint numShares);
    event RebalanceSwap(address indexed user, uint lusdAmount, uint ethAmount, uint timestamp);

    constructor(
        address _priceAggregator,
        address _LUSD,
        address _cETH,
        address _cBorrow,
        uint _maxDiscount,
        address payable _feePool)
        public
    {
        priceAggregator = AggregatorV3Interface(_priceAggregator);
        LUSD = IERC20(_LUSD);
        lusdDecimals = IERC20(_LUSD).decimals();
        cETH = ICToken(_cETH);
        cBorrow = ICToken(_cBorrow);

        feePool = _feePool;
        maxDiscount = _maxDiscount;

        require(IERC20(_LUSD).decimals() <= 18, "unsupported decimals");
    }

    function setParams(uint _A, uint _fee, uint _callerFee) external onlyOwner {
        require(_fee <= MAX_FEE, "setParams: fee is too big");
        require(_callerFee <= MAX_CALLER_FEE, "setParams: caller fee is too big");        
        require(_A >= MIN_A, "setParams: A too small");
        require(_A <= MAX_A, "setParams: A too big");

        fee = _fee;
        callerFee = _callerFee;
        A = _A;

        emit ParamsSet(_A, _fee, _callerFee);
    }

    function fetchPrice() public view returns(uint) {
        uint chainlinkDecimals;
        uint chainlinkLatestAnswer;
        uint chainlinkTimestamp;

        // First, try to get current decimal precision:
        try priceAggregator.decimals() returns (uint8 decimals) {
            // If call to Chainlink succeeds, record the current decimal precision
            chainlinkDecimals = decimals;
        } catch {
            // If call to Chainlink aggregator reverts, return a zero response with success = false
            return 0;
        }

        // Secondly, try to get latest price data:
        try priceAggregator.latestRoundData() returns
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

        uint chainlinkFactor = (10 ** (18 + chainlinkDecimals - lusdDecimals));
        return chainlinkLatestAnswer.mul(PRECISION) / chainlinkFactor;
    }

    function deposit(uint lusdAmount) external {        
        // update share
        uint lusdValue = LUSD.balanceOf(address(this));
        uint ethValue = address(this).balance;

        uint price = fetchPrice();
        require(ethValue == 0 || price > 0, "deposit: chainlink is down");

        uint totalValue = lusdValue.add(ethValue.mul(price) / PRECISION);

        // this is in theory not reachable. if it is, better halt deposits
        // the condition is equivalent to: (totalValue = 0) ==> (totalSupply = 0)
        require(totalValue > 0 || totalSupply == 0, "deposit: system is rekt");

        uint newShare = PRECISION;
        if(totalSupply > 0) newShare = totalSupply.mul(lusdAmount) / totalValue;

        // deposit
        require(LUSD.transferFrom(msg.sender, address(this), lusdAmount), "deposit: transferFrom failed");

        // update LP token
        mint(msg.sender, newShare);

        emit UserDeposit(msg.sender, lusdAmount, newShare);        
    }

    function withdraw(uint numShares) external {
        uint lusdValue = LUSD.balanceOf(address(this));
        uint ethValue = address(this).balance;

        uint lusdAmount = lusdValue.mul(numShares).div(totalSupply);
        uint ethAmount = ethValue.mul(numShares).div(totalSupply);

        // update LP token
        burn(msg.sender, numShares);

        // send lusd and eth
        if(lusdAmount > 0) LUSD.transfer(msg.sender, lusdAmount);
        if(ethAmount > 0) {
            (bool success, ) = msg.sender.call{ value: ethAmount }(""); // re-entry is fine here
            require(success, "withdraw: sending ETH failed");
        }

        emit UserWithdraw(msg.sender, lusdAmount, ethAmount, numShares);            
    }

    function addBps(uint n, int bps) internal pure returns(uint) {
        require(bps <= 10000, "reduceBps: bps exceeds max");
        require(bps >= -10000, "reduceBps: bps exceeds min");

        return n.mul(uint(10000 + bps)) / 10000;
    }

    function getSwapEthAmount(uint lusdQty) public view returns(uint ethAmount) {
        uint lusdBalance = LUSD.balanceOf(address(this));
        uint ethBalance  = address(this).balance;

        uint eth2usdPrice = fetchPrice();
        if(eth2usdPrice == 0) return 0; // chainlink is down

        uint ethUsdValue = ethBalance.mul(eth2usdPrice) / PRECISION;
        uint maxReturn = addBps(lusdQty.mul(PRECISION) / eth2usdPrice, int(maxDiscount));

        uint xQty = lusdQty;
        uint xBalance = lusdBalance;
        uint yBalance = lusdBalance.add(ethUsdValue.mul(2));
        
        uint usdReturn = getReturn(xQty, xBalance, yBalance, A);
        uint basicEthReturn = usdReturn.mul(PRECISION) / eth2usdPrice;

        if(ethBalance < basicEthReturn) basicEthReturn = ethBalance; // cannot give more than balance 
        if(maxReturn < basicEthReturn) basicEthReturn = maxReturn;

        ethAmount = basicEthReturn;
    }

    // get ETH in return to LUSD
    function swap(uint lusdAmount, uint minEthReturn, address payable dest) public returns(uint) {
        uint ethAmount = getSwapEthAmount(lusdAmount);

        require(ethAmount >= minEthReturn, "swap: low return");

        require(LUSD.transferFrom(msg.sender, address(this), lusdAmount), "swap: transferFrom failed");

        uint feeAmount = addBps(lusdAmount, int(fee)).sub(lusdAmount);
        if(feeAmount > 0) require(LUSD.transfer(feePool, feeAmount), "swap: transfer failed");

        (bool success, ) = dest.call{ value: ethAmount }(""); // re-entry is fine here
        require(success, "swap: sending ETH failed");

        emit RebalanceSwap(msg.sender, lusdAmount, ethAmount, now);

        return ethAmount;
    }

    receive() external payable {}

    function canLiquidate(
        address cTokenBorrowed,
        address cTokenCollateral,
        uint repayAmount
    )
        external
        view
        returns(bool)
    {
        if(cTokenBorrowed != address(cBorrow)) return false;
        if(cTokenCollateral != address(cETH)) return false;

        return repayAmount <= LUSD.balanceOf(address(this));
    }

    // callable by anyone
    function liquidateBorrow(address borrower, uint amount, address collateral) external returns (uint) {
        require(collateral == address(cETH), "liquidateBorrow: only cETH collateral is allowed");

        uint ethBalBefore = address(this).balance;
        IERC20(LUSD).approve(address(cBorrow), amount);
        require(cBorrow.liquidateBorrow(borrower, amount, collateral) == 0, "liquidateBorrow: liquidation failed");
        IERC20(LUSD).approve(address(cBorrow), 0);
        require(cETH.redeem(cETH.balanceOf(address(this))) == 0, "liquidateBorrow: cETH redeem failed");
        uint ethBalAfter = address(this).balance;

        uint deltaEth = ethBalAfter.sub(ethBalBefore);
        uint feeAmount = addBps(deltaEth, int(callerFee)).sub(deltaEth);
        if(feeAmount > 0 ) msg.sender.transfer(feeAmount);

        // do sanity check on the price
        uint price = fetchPrice();
        require(deltaEth.mul(price) / PRECISION >= addBps(amount, int(maxDiscount)), "liquidation discount is too low");
    }    
}


// TODO
// 5) check return value of erc20