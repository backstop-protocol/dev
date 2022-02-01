// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

import "./BAMM.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

interface FeePoolVaultLike {
    function op(address target, bytes calldata data, uint value) external;
    function transferOwnership(address newOwner) external;
}

contract KeeperRebate is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    address immutable public feePool;
    BAMM immutable public bamm;
    IERC20 immutable public lusd;
    IERC20 constant public ETH = IERC20(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
    EnumerableSet.AddressSet keepers;
    address public keeperLister;

    struct TokensData {
        IERC20 inToken;
        IERC20[] outTokens;
        IERC20[] rebateTokens;
    }    

    event SwapSummary(address indexed keeper, IERC20 tokenIn, uint inAmount, IERC20 tokenOut, uint outAmount, uint rebateAmount);    
    event NewLister(address lister);
    event KeeperListing(address keeper, bool list);

    constructor(BAMM _bamm) public {
        bamm = _bamm;
        lusd = _bamm.LUSD();
        feePool = _bamm.feePool();

        IERC20(_bamm.LUSD()).approve(address(_bamm), uint(-1));
    }

    function getReturnedSwapAmount(IERC20 tokenIn, uint inAmount, IERC20 tokenOut)
        public
        view
        returns(uint outAmount, IERC20 rebateToken, uint rebateAmount) {
        if(tokenIn == lusd && tokenOut == ETH) {
            (outAmount, rebateAmount) = bamm.getSwapEthAmount(inAmount);
        }

        rebateToken = lusd;
    }    

    function swap(IERC20 tokenIn, uint inAmount, IERC20 tokenOut, uint minOutAmount, uint maxRebate, address payable dest)
        public
        payable
        returns(uint outAmount, uint rebateAmount)
    {
        require(tokenIn == lusd, "swap: invalid tokenIn");
        require(tokenOut == ETH, "swap: invalid tokenOut");

        (outAmount, rebateAmount) = swapWithRebate(inAmount, minOutAmount, maxRebate, dest);

        emit SwapSummary(msg.sender, tokenIn, inAmount, tokenOut, outAmount, rebateAmount);
    }

    function getTokens() public view returns(TokensData[] memory tokens) {
        tokens = new TokensData[](1);
        tokens[0].inToken = lusd;

        tokens[0].outTokens = new IERC20[](1);
        tokens[0].rebateTokens = new IERC20[](1);

        tokens[0].outTokens[0] = ETH;
        tokens[0].rebateTokens[0] = lusd;
    }

    function transferFeePoolOwnership(address newOwner) public onlyOwner {
        FeePoolVaultLike(feePool).transferOwnership(newOwner);
    }

    function setKeeperLister(address lister) public onlyOwner {
        keeperLister = lister;
        emit NewLister(lister);
    }
    
    function listKeeper(address keeper, bool list) public {
        require(msg.sender == keeperLister, "listKeeper: !lister");

        if(list) require(keepers.add(keeper), "listKeeper: keepers.add failed");
        else require(keepers.remove(keeper), "listKeeper: keepers.remove failed");

        KeeperListing(keeper, list);
    }

    function swapWithRebate(uint lusdAmount, uint minEthReturn, uint maxLusdRebate, address payable dest)
        internal
        returns(uint ethAmount, uint lusdRebate)
    {
        require(keepers.contains(msg.sender), "swapWithRebate: !keeper");
        lusd.transferFrom(msg.sender, address(this), lusdAmount);

        uint feeBps = bamm.fee();
        // if lusd amount is 0 it will revert, but this is fine
        require(feeBps * lusdAmount / lusdAmount == feeBps, "swapWithRebate: overflow");
        lusdRebate = feeBps * lusdAmount / 10000;

        // adjust rebate to max fee
        if(lusdRebate > maxLusdRebate) lusdRebate = maxLusdRebate;

        ethAmount = bamm.swap(lusdAmount, minEthReturn, dest);

        rebate(dest, lusdRebate);
    }

    function rebate(address payable dest, uint amount) internal {
        bytes memory data = abi.encodeWithSignature("transfer(address,uint256)", dest, amount);
        FeePoolVaultLike(feePool).op(address(lusd), data, 0);
    }
}