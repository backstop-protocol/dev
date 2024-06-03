// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import { ICToken } from "./BAMM.sol";
import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./../Dependencies/Ownable.sol";

interface ILendingPoolAddressesProvider {
    function getLendingPool() external view returns(address);
}

interface ILendingPool {
  function withdraw(
    address asset,
    uint256 amount,
    address to
  ) external;

  function liquidationCall(
    address collateralAsset,
    address debtAsset,
    address user,
    uint256 debtToCover,
    bool receiveAToken
  ) external;      
}

interface IAToken is IERC20 {
    function UNDERLYING_ASSET_ADDRESS() view external returns(address);
    function decimals() view external returns(uint8);
    function symbol() view external returns(string memory);
}


contract AaveToCTokenAdapter is ICToken, Ownable {
    using SafeERC20 for IERC20;

    ILendingPoolAddressesProvider public immutable lendingPoolAddressesProvider;
    IAToken public immutable aToken;

    constructor(IAToken _aToken, ILendingPoolAddressesProvider _lendingPoolAddressesProvider) public {
        lendingPoolAddressesProvider = _lendingPoolAddressesProvider;
        aToken = _aToken;
    }

    // read functions
    function balanceOf(address a) external override view returns (uint) {
        return aToken.balanceOf(a);        
    }

    function underlying() public override view returns(IERC20) {
        return IERC20(aToken.UNDERLYING_ASSET_ADDRESS());
    }

    function getCash() external override view returns(uint) {
        return underlying().balanceOf(address(aToken));
    }

    function getAccountSnapshot(address account)
        external
        view
        override
        returns(uint err, uint cTokenBalance, uint borrowBalance, uint exchangeRateMantissa)
    {
        require(account == owner(), "getAccountSnapshot: only owner is supported");

        err = 0;
        cTokenBalance = aToken.balanceOf(account);
        exchangeRateMantissa = 1e18; // 1, as balance returns the underlying value
        borrowBalance = 0; // never borrow
    }

    function decimals() public view returns(uint8) {
        return aToken.decimals();
    }

    function symbol() public view returns(string memory) {
        return aToken.symbol();
    }

    // admin funcrion - this is called only once, as bamm won't be able to call it again
    function setBAMM(address bamm) external onlyOwner {
        transferOwnership(bamm);
    }

    // write functions
    function redeemUnderlying(uint redeemAmount) external override onlyOwner returns (uint) {
        IERC20(aToken).safeTransferFrom(msg.sender, address(this), redeemAmount);        
        address pool = lendingPoolAddressesProvider.getLendingPool();
        IERC20(aToken).safeApprove(pool, redeemAmount);
        ILendingPool(pool).withdraw(address(underlying()), redeemAmount, msg.sender);

        return 0;
    }

    function liquidateBorrow(address borrower, uint amount, address collateral) external override onlyOwner returns (uint) {        
        address collateralUnderlying = address(IAToken(collateral).UNDERLYING_ASSET_ADDRESS());
        address debt = address(underlying());

        IERC20(debt).safeTransferFrom(msg.sender, address(this), amount);
        address pool = lendingPoolAddressesProvider.getLendingPool();
        IERC20(debt).safeApprove(pool, amount);

        ILendingPool(pool).liquidationCall(collateralUnderlying, debt, borrower, amount, true);

        // send collateral atoken to bamm
        IERC20(collateral).safeTransfer(msg.sender, IERC20(collateral).balanceOf(address(this)));

        return 0;
    }

    function transfer(address to, uint amount) external onlyOwner returns (bool) {
        IERC20(aToken).safeTransferFrom(msg.sender, to, amount);

        return true;
    }

    function transferFrom(address from, address to, uint tokens) external onlyOwner returns (bool) {
        require(to == owner(), "transferFrom: only pulling by owner is supported");

        IERC20(aToken).safeTransferFrom(from, address(this), tokens);
        IERC20(aToken).safeTransfer(to, tokens);

        return true;
    }
}
