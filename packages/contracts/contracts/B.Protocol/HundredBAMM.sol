// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import { BAMM } from "./BAMM.sol";

interface SymbolLike {
    function symbol() view external returns(string memory);
}

contract HundredBAMM is BAMM {
    constructor(
        address _cBorrow,
        bool _isCETH,
        uint _maxDiscount,
        address payable _feePool)
        public
        BAMM(_cBorrow, _isCETH, _maxDiscount, _feePool)
    {
        string memory ctokenSymbol = SymbolLike(_cBorrow).symbol();
        symbol = string(abi.encodePacked(string("b"), ctokenSymbol));
        name = symbol;
    }

    function collateralCount() public view returns(uint) {
        return collaterals.length;
    }
}