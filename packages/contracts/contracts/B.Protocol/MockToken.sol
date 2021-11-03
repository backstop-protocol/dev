// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./TokenAdapter.sol";

contract MockToken is TokenAdapter {
    constructor(uint decimals) public {
        decimals = decimals;
    }

    function mintToken(address to, uint tokens) public {
        mint(to, tokens);
    }
}

/*
contract MockCETH {

}*/