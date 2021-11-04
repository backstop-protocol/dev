
// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./../Dependencies/IERC20.sol";

contract MockCToken {
    IERC20 token;
    bool isEth;    
    mapping(address => uint) public balanceOf;
    uint tokenToCETHPrice;

    constructor(IERC20 token, bool isETH) public;

    function depositToken(uint amount) public;
    function depositEther(uint amount) public;    

    function transfer(address from, address to, uint amount) public;

    function setCETHPrice(uint price) public;
}