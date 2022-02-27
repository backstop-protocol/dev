// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

contract FlashswapStub {
    address public initiator;
    uint public lusdAmount;
    uint public returnAmount;
    bytes public data;

    function bammFlashswap(address _initiator, uint _lusdAmount, uint _returnAmount, bytes memory _data) external {
        initiator = _initiator;
        lusdAmount = _lusdAmount;
        returnAmount = _returnAmount;
        data = _data;
    }
}