// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./HundredBAMM.sol";
import "./AaveToCTokenAdapter.sol";

contract AaveBAMM is HundredBAMM {
    constructor(
        address _cBorrow,
        bool _isCETH,
        uint _maxDiscount,
        address payable _feePool)
        public
        HundredBAMM(_cBorrow, _isCETH, _maxDiscount, _feePool)
    {
        // give allowance to cBorrow
        IERC20(AaveToCTokenAdapter(_cBorrow).aToken()).safeApprove(_cBorrow, uint(-1));
    }

    function addCollateral(ICToken ctoken, AggregatorV3Interface feed) override public onlyOwner {
        IERC20(address(ctoken)).safeApprove(address(ctoken), uint(-1));

        super.addCollateral(ctoken, feed);
    }

    function removeCollateral(ICToken ctoken) override public onlyOwner {
        IERC20(address(ctoken)).safeApprove(address(ctoken), uint(0));

        super.removeCollateral(ctoken);        
    }

    function canLiquidate(
        ICToken cTokenBorrowed,
        ICToken cTokenCollateral,
        uint repayAmount
    )
        external
        view
        override
        returns(bool)
    {
        if(address(cTokenBorrowed) != address(cBorrow.underlying())) return false;
        bool validCollateral = false;
        for(uint i = 0 ; i < collaterals.length ; i++) {
            if(address(cTokenCollateral) == IAToken(address(collaterals[i])).UNDERLYING_ASSET_ADDRESS()) {
                validCollateral = true;
                break;
            }
        }

        if(! validCollateral) return false;

        // check if there is sufficient balance at the backstop
        (uint err, uint ctokenBalance, /* borrow balance */, uint exchangeRateMantissa) = cBorrow.getAccountSnapshot(address(this));
        if(err != 0) return false;

        uint underlyingBalance = ctokenBalance.mul(exchangeRateMantissa) / 1e18;

        if(repayAmount > underlyingBalance) return false;
        if(repayAmount > cBorrow.getCash()) return false;

        return true;
    }
}