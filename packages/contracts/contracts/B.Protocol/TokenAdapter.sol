// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./../Dependencies/SafeMath.sol";


contract TokenAdapter {
    using SafeMath for uint256;

    string constant public name = "B.AMM";
    string constant public symbol = "BAMM";
    uint constant public decimals = 18;

    uint public totalSupply;

    event Transfer(address indexed from, address indexed to, uint tokens);
    event Approval(address indexed tokenOwner, address indexed spender, uint tokens);

    // balanceOf for each account
    mapping(address => uint256) public balanceOf;
 
    // Owner of account approves the transfer of an amount to another account
    mapping(address => mapping (address => uint256)) public allowance;
 
    // Transfer the balance from owner's account to another account
    function transfer(address to, uint tokens) public returns (bool success) {
        balanceOf[msg.sender] = balanceOf[msg.sender].sub(tokens);
        balanceOf[to] = balanceOf[to].add(tokens);
        Transfer(msg.sender, to, tokens);
        return true;
    }
 
    // Send `tokens` amount of tokens from address `from` to address `to`
    // The transferFrom method is used for a withdraw workflow, allowing contracts to send
    // tokens on your behalf, for example to "deposit" to a contract address and/or to charge
    // fees in sub-currencies; the command should fail unless the _from account has
    // deliberately authorized the sender of the message via some mechanism; we propose
    // these standardized APIs for approval:
    function transferFrom(address from, address to, uint tokens) public returns (bool success) {
        balanceOf[from] = balanceOf[from].sub(tokens);
        allowance[from][msg.sender] = allowance[from][msg.sender].sub(tokens);
        balanceOf[to] = balanceOf[to].add(tokens);
        Transfer(from, to, tokens);
        return true;
    }
 
    // Allow `spender` to withdraw from your account, multiple times, up to the `tokens` amount.
    // If this function is called again it overwrites the current allowance with _value.
    function approve(address spender, uint tokens) public returns (bool success) {
        allowance[msg.sender][spender] = tokens;
        Approval(msg.sender, spender, tokens);
        return true;
    }

    function mint(address to, uint tokens) internal {
        balanceOf[to] = balanceOf[to].add(tokens);
        totalSupply = totalSupply.add(tokens);

        emit Transfer(address(0), to, tokens);
    }

    function burn(address owner, uint tokens) internal {
        balanceOf[owner] = balanceOf[owner].sub(tokens);
        totalSupply = totalSupply.sub(tokens);

        emit Transfer(owner, address(0), tokens);        
    }
}

