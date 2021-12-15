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
    function underlying() external view returns(address);
}

contract BAMM is TokenAdapter, PriceFormula, Ownable {
    using SafeMath for uint256;

    IERC20 public immutable LUSD;
    uint public immutable lusdDecimals;
    IERC20[] public collaterals; // IMPORTANT - collateral != LUSD
    mapping(address => AggregatorV3Interface) public priceAggregators;
    mapping(address => uint) public collateralDecimals;    
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
    event UserWithdraw(address indexed user, uint lusdAmount, uint numShares);
    event RebalanceSwap(address indexed user, uint lusdAmount, IERC20 token, uint tokenAmount, uint timestamp);

    constructor(
        address _LUSD,
        address _cBorrow,
        uint _maxDiscount,
        address payable _feePool)
        public
    {
        LUSD = IERC20(_LUSD);
        lusdDecimals = IERC20(_LUSD).decimals();
        cBorrow = ICToken(_cBorrow);

        feePool = _feePool;
        maxDiscount = _maxDiscount;

        IERC20(_LUSD).approve(address(_cBorrow), uint(-1));

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

    function addCollateral(IERC20 token, AggregatorV3Interface feed) external onlyOwner {
        require(token != LUSD, "addCollateral: LUSD cannot be collateral");
        require(feed != AggregatorV3Interface(0x0), "addCollateral: invalid feed");
        require(priceAggregators[address(token)] == AggregatorV3Interface(0x0), "addCollateral: collateral listed");

        collaterals.push(token);
        priceAggregators[address(token)] = feed;
        collateralDecimals[address(token)] = token.decimals();
    }

    function removeCollateral(IERC20 token) external onlyOwner {
        for(uint i = 0 ; i < collaterals.length ; i++) {
            if(collaterals[i] == token) {
                collaterals[i] = collaterals[collaterals.length - 1];
                collaterals.pop();
                priceAggregators[address(token)] = AggregatorV3Interface(0x0);
                break;
            }
        }
    }

    function fetchPrice(IERC20 token) public view returns(uint) {
        AggregatorV3Interface priceAggregator = priceAggregators[address(token)];
        if(priceAggregator == AggregatorV3Interface(address(0x0))) return 0;

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

        int chainlinkDecimalFactor = int(chainlinkDecimals + collateralDecimals[address(token)]) - int(lusdDecimals);
        if(chainlinkDecimalFactor >= 0) {
            return chainlinkLatestAnswer.mul(PRECISION) / (10 ** uint(chainlinkDecimalFactor));
        }
        else {
            return chainlinkLatestAnswer.mul(PRECISION) * (10 ** uint(-1 * chainlinkDecimalFactor));
        }
    }

    function getCollateralValue() public view returns(bool succ, uint value) {
        value = 0;
        succ = true;

        for(uint i = 0 ; i < collaterals.length ; i++) {
            IERC20 token = collaterals[i];
            uint bal = token.balanceOf(address(this));
            if(bal > 0) {
                uint price = fetchPrice(token);
                if(price == 0) {
                    succ = false;
                    break;
                }

                value = value.add(bal.mul(price) / PRECISION);                
            }
        }
    }


    function deposit(uint lusdAmount) external {        
        // update share
        uint lusdValue = LUSD.balanceOf(address(this));
        (bool succ, uint colValue) = getCollateralValue();

        require(succ, "deposit: chainlink is down");

        uint totalValue = lusdValue.add(colValue);

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
        uint supplyBefore = totalSupply; // this is to save gas

        uint lusdBal = LUSD.balanceOf(address(this));
        uint lusdAmount = lusdBal.mul(numShares).div(supplyBefore);

        uint[] memory collateralAmounts = new uint[](collaterals.length);
        IERC20[] memory collateralTypes = collaterals;

        for(uint i = 0 ; i < collateralTypes.length ; i++) {
            uint bal = collateralTypes[i].balanceOf(address(this));
            collateralAmounts[i] = bal.mul(numShares).div(supplyBefore);
        }

        // update LP token
        burn(msg.sender, numShares);

        // send lusd and collateral leftovers
        if(lusdAmount > 0) LUSD.transfer(msg.sender, lusdAmount);
        for(uint i = 0 ; i < collateralTypes.length ; i++) {
            if(collateralAmounts[i] > 0 ) collateralTypes[i].transfer(msg.sender, collateralAmounts[i]); // re-entry is fine here (?)
        }

        emit UserWithdraw(msg.sender, lusdAmount, numShares);            
    }

    function addBps(uint n, int bps) internal pure returns(uint) {
        require(bps <= 10000, "reduceBps: bps exceeds max");
        require(bps >= -10000, "reduceBps: bps exceeds min");

        return n.mul(uint(10000 + bps)) / 10000;
    }

    function getSwapAmount(uint lusdQty, IERC20 token) public view returns(uint tokenAmount) {
        uint lusdBalance = LUSD.balanceOf(address(this));
        uint tokenBalance  = token.balanceOf(address(this));

        (bool succ, uint collateralValue) = getCollateralValue();
        if(! succ) return 0; // chainlink is down

        uint token2usdPrice = fetchPrice(token);
        if(token2usdPrice == 0) return 0; // chainlink is down

        uint maxReturn = addBps(lusdQty.mul(PRECISION) / token2usdPrice, int(maxDiscount));

        uint xQty = lusdQty;
        uint xBalance = lusdBalance;
        uint yBalance = lusdBalance.add(collateralValue.mul(2));
        
        uint usdReturn = getReturn(xQty, xBalance, yBalance, A);
        uint basicTokenReturn = usdReturn.mul(PRECISION) / token2usdPrice;

        if(tokenBalance < basicTokenReturn) basicTokenReturn = tokenBalance; // cannot give more than balance 
        if(maxReturn < basicTokenReturn) basicTokenReturn = maxReturn;

        tokenAmount = basicTokenReturn;
    }

    // get token in return to LUSD
    function swap(uint lusdAmount, IERC20 returnToken, uint minReturn, address payable dest) public returns(uint) {
        require(returnToken != LUSD, "swap: hackers - curse upon you ipfs://QmNz8h7tccoCvUGKicZxbhTDEey8v8n2mv4MSVM1gryWk9");

        uint returnAmount = getSwapAmount(lusdAmount, returnToken);

        require(returnAmount >= minReturn, "swap: low return");

        require(LUSD.transferFrom(msg.sender, address(this), lusdAmount), "swap: transferFrom failed");

        uint feeAmount = addBps(lusdAmount, int(fee)).sub(lusdAmount);
        if(feeAmount > 0) require(LUSD.transfer(feePool, feeAmount), "swap: transfer failed");

        require(returnToken.transfer(dest, returnAmount), "swap: transfer token failed");

        emit RebalanceSwap(msg.sender, lusdAmount, returnToken, returnAmount, now);

        return returnAmount;
    }

    receive() external payable {}

    function canLiquidate(
        ICToken cTokenBorrowed,
        ICToken cTokenCollateral,
        uint repayAmount
    )
        external
        view
        returns(bool)
    {
        if(cTokenBorrowed != cBorrow) return false;

        AggregatorV3Interface feed = priceAggregators[cTokenCollateral.underlying()];
        if((feed == AggregatorV3Interface(0)) && (cTokenCollateral != cTokenBorrowed)) return false;

        return repayAmount <= LUSD.balanceOf(address(this));
    }

    // callable by anyone
    function liquidateBorrow(address borrower, uint amount, ICToken collateral) external returns (uint) {
        IERC20 colToken = IERC20(collateral.underlying());

        uint tokenBalBefore = colToken.balanceOf(address(this));
        require(cBorrow.liquidateBorrow(borrower, amount, address(collateral)) == 0, "liquidateBorrow: liquidation failed");
        require(collateral.redeem(collateral.balanceOf(address(this))) == 0, "liquidateBorrow: collateral redeem failed");       
        uint tokenBalAfter = colToken.balanceOf(address(this));

        uint deltaToken = tokenBalAfter.sub(tokenBalBefore);
        if(collateral == cBorrow) deltaToken = amount;

        uint feeAmount = addBps(deltaToken, int(callerFee)).sub(deltaToken);
        if(feeAmount > 0 ) colToken.transfer(msg.sender, feeAmount);
    }    
}

