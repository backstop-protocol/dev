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
        IERC20(AaveToCTokenAdapter(address(ctoken)).aToken()).safeApprove(address(ctoken), uint(-1));

        super.addCollateral(ctoken, feed);
    }

    function removeCollateral(ICToken ctoken) override public onlyOwner {
        IERC20(AaveToCTokenAdapter(address(ctoken)).aToken()).safeApprove(address(ctoken), uint(0));

        super.removeCollateral(ctoken);        
    }
}