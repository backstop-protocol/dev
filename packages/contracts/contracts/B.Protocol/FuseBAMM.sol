// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./HundredBAMM.sol";


interface SetSeizePausedLike {
    function _setSeizePaused(bool state) external returns (bool);
}

interface OwnerByComptrollerLike {
    function comptroller() external view returns(address);
}

interface OwnerByAdminLike {
    function admin() external view returns(address);
}

contract FuseBAMM is HundredBAMM {
    constructor(
        address _cBorrow,
        bool _isCETH,
        uint _maxDiscount,
        address payable _feePool)
        public
        HundredBAMM(_cBorrow, _isCETH, _maxDiscount, _feePool)
    {

    }

    function liquidateBorrow(address borrower, uint amount, ICToken collateral) public override returns (uint) {
        address bAdmin = OwnerByAdminLike(OwnerByComptrollerLike(address(cBorrow)).comptroller()).admin();

        SetSeizePausedLike(bAdmin)._setSeizePaused(false);
        uint retVal = super.liquidateBorrow(borrower, amount, collateral);
        SetSeizePausedLike(bAdmin)._setSeizePaused(true);

        return retVal;
    } 
}