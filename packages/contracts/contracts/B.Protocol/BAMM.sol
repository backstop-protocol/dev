// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./TokenAdapter.sol";
import "./PriceFormula.sol";
import "./../Interfaces/IPriceFeed.sol";
import "./../Dependencies/SafeMath.sol";
import "./../Dependencies/Ownable.sol";
import "./../Dependencies/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";


interface ICToken {
    function balanceOf(address a) external view returns (uint);
    function liquidateBorrow(address borrower, uint amount, address collateral) external returns (uint);
    function underlying() external view returns(IERC20);
    function getCash() external view returns(uint);
    function balanceOfUnderlying(address account) external view returns (uint);
    function redeemUnderlying(uint redeemAmount) external returns (uint);
}

interface ICETH {
    function liquidateBorrow(address borrower, address cTokenCollateral) payable external;
}

interface IFlashswap {
    function bammFlashswap(address initiator, uint lusdAmount, uint returnAmount, bytes memory data) external; 
}

contract BAMM is TokenAdapter, PriceFormula, Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public immutable LUSD;
    uint public immutable lusdDecimals;
    IERC20[] public collaterals; // IMPORTANT - collateral != LUSD
    mapping(address => AggregatorV3Interface) public priceAggregators;
    mapping(address => uint) public collateralDecimals;
    mapping(address => bool) public cTokens;
    ICToken public immutable cBorrow;
    bool public immutable isCETH;

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
        address _cBorrow,
        bool _isCETH,
        uint _maxDiscount,
        address payable _feePool)
        public
    {
        LUSD = IERC20(_cBorrow);
        lusdDecimals = ERC20(_cBorrow).decimals();
        cBorrow = ICToken(_cBorrow);
        isCETH = _isCETH;

        feePool = _feePool;
        maxDiscount = _maxDiscount;

        if(! _isCETH) IERC20(ICToken(_cBorrow).underlying()).safeApprove(address(_cBorrow), uint(-1));

        require(ERC20(_cBorrow).decimals() <= 18, "unsupported decimals");
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

    function addCollateral(ICToken ctoken, AggregatorV3Interface feed) external onlyOwner {
        IERC20 token = IERC20(address(ctoken));

        // validations
        require(token != LUSD, "addCollateral: LUSD cannot be collateral");
        require(feed != AggregatorV3Interface(0x0), "addCollateral: invalid feed");
        require(! cTokens[address(ctoken)], "addCollateral: collateral listed");
        require(priceAggregators[address(token)] == AggregatorV3Interface(0x0), "addCollateral: underlying already added");

        // add the token
        collaterals.push(token);
        priceAggregators[address(token)] = feed;
        collateralDecimals[address(token)] = ERC20(address(token)).decimals();
        cTokens[address(ctoken)] = true;        
    }

    function removeCollateral(ICToken ctoken) external onlyOwner {
        IERC20 token = IERC20(address(ctoken));

        for(uint i = 0 ; i < collaterals.length ; i++) {
            if(collaterals[i] == token) {
                collaterals[i] = collaterals[collaterals.length - 1];
                collaterals.pop();
                priceAggregators[address(token)] = AggregatorV3Interface(0x0);
                cTokens[address(ctoken)] = false;
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


    function deposit(uint lusdAmount) external nonReentrant {        
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
        LUSD.safeTransferFrom(msg.sender, address(this), lusdAmount);

        // update LP token
        mint(msg.sender, newShare);

        emit UserDeposit(msg.sender, lusdAmount, newShare);        
    }

    function efficientWithdraw(uint numShares, address to, bool withdrawCollateral, uint minLusd) public nonReentrant {
        uint supplyBefore = totalSupply; // this is to save gas

        uint lusdBal = LUSD.balanceOf(address(this));
        uint lusdAmount = lusdBal.mul(numShares).div(supplyBefore);
        require(lusdAmount >= minLusd, "efficientWithdraw: insufficient lusd amount");

        uint[] memory collateralAmounts = new uint[](collaterals.length);
        IERC20[] memory collateralTypes = collaterals;

        for(uint i = 0 ; (i < collateralTypes.length) && withdrawCollateral ; i++) {
            uint bal = collateralTypes[i].balanceOf(address(this));
            collateralAmounts[i] = bal.mul(numShares).div(supplyBefore);
        }

        // update LP token
        burn(msg.sender, numShares);

        // send lusd and collateral leftovers
        if(lusdAmount > 0) LUSD.safeTransfer(to, lusdAmount);
        for(uint i = 0 ; i < collateralTypes.length ; i++) {
            if(collateralAmounts[i] > 0 ) collateralTypes[i].safeTransfer(to, collateralAmounts[i]);
        }

        emit UserWithdraw(msg.sender, lusdAmount, numShares);            
    }

    function withdraw(uint numShares) external {
        efficientWithdraw(numShares, msg.sender, true, 0);
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
    function swap(uint lusdAmount, IERC20 returnToken, uint minReturn, address payable dest, bytes memory data) public nonReentrant returns(uint) {
        require(returnToken != LUSD, "swap: unsupported");

        uint returnAmount = getSwapAmount(lusdAmount, returnToken);

        require(returnAmount >= minReturn, "swap: low return");

        uint feeAmount = addBps(lusdAmount, int(fee)).sub(lusdAmount);
        if(feeAmount > 0) LUSD.safeTransfer(feePool, feeAmount);

        // first send the return
        returnToken.safeTransfer(dest, returnAmount);

        // now dest can prepare the lusd - and send it to msg.sender
        if(data.length != 0) IFlashswap(dest).bammFlashswap(msg.sender, lusdAmount, returnAmount, data);

        // get the lusd
        LUSD.safeTransferFrom(msg.sender, address(this), lusdAmount);

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
        if((! cTokens[address(cTokenCollateral)]) && (cTokenCollateral != cTokenBorrowed)) return false;

        // check if there is sufficient balance at the backstop
        if(repayAmount > cBorrow.balanceOfUnderlying(address(this))) return false;
        if(repayAmount > cBorrow.getCash()) return false;

        return true;
    }

    // callable by anyone
    function liquidateBorrow(address borrower, uint amount, ICToken collateral) external nonReentrant returns (uint) {
        require(cTokens[address(collateral)] || collateral == cBorrow, "liquidateBorrow: invalid collateral");

        IERC20 colToken = IERC20(address(collateral));

        uint tokenBalBefore = colToken.balanceOf(address(this));
        require(cBorrow.redeemUnderlying(amount) == 0, "liquidateBorrow: redeem failed");
        if(isCETH) {
            ICETH(address(cBorrow)).liquidateBorrow{value: amount}(borrower, address(collateral));            
        }
        else {
            require(cBorrow.liquidateBorrow(borrower, amount, address(collateral)) == 0, "liquidateBorrow: liquidation failed");
        }

        uint tokenBalAfter = colToken.balanceOf(address(this));

        // if collateral == cBorrow, then caller fee will be quite small, but this is a feature
        uint deltaToken = tokenBalAfter.sub(tokenBalBefore);

        uint feeAmount = addBps(deltaToken, int(callerFee)).sub(deltaToken);
        if(feeAmount > 0 ) colToken.safeTransfer(msg.sender, feeAmount);
    }    
}

