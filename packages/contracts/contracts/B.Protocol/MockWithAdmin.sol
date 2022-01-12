// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

contract MockWithAdmin {
    address public admin;

    function setAdmin(address _admin) public {
        admin = _admin;
    }
}