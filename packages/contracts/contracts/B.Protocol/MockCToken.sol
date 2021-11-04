
// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./../Dependencies/IERC20.sol";

contract MockCToken {
    IERC20 token;
    bool isEth;    
    mapping(address => uint) public balanceOf;
    uint tokenToCETHPrice;

    constructor (IERC20 _token, bool _isETH) public {
        token = _token;
        isEth = _isETH;
    }

    function redeem(uint redeemTokens) external returns (uint) {
        require(balanceOf[msg.sender] >= redeemTokens, "redeem: insufficient ballance");

        if(isEth) msg.sender.transfer(redeemTokens);
        else token.transfer(msg.sender, redeemTokens);

        balanceOf[msg.sender] -= redeemTokens;
    }
        
    function depositToken(uint amount) public {
        token.transferFrom(msg.sender, address(this), amount);
        balanceOf[msg.sender] += amount;
    }

    function depositEther() public payable {
        balanceOf[msg.sender] += msg.value; 
    }

    function transfer(address from, address to, uint amount) public {
        require(balanceOf[from] >= amount, "transfer: insufficient ballance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }

    function setCETHPrice(uint price) public {
        tokenToCETHPrice = price;
    }

    function liquidateBorrow(address borrower, uint amount, MockCToken collateral) external returns (uint) {
        require(isEth == false, "cant liquidate ETH");
        token.transferFrom(msg.sender, address(this), amount);
        collateral.transfer(borrower, msg.sender, amount*tokenToCETHPrice/1e18);
    }
}