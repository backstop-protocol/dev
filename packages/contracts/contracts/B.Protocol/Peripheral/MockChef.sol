// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

interface IERC20 {
    function balanceOf(address a) external returns(uint);
    function transfer(address to, uint amount) external returns(bool);
    function transferFrom(address _from, address _to, uint256 _value) external returns(bool);
    function approve(address _spender, uint256 _value) external returns(bool);
}

contract MockChef {
    IERC20 immutable rewardToken;
    IERC20 immutable bammToken;
    uint immutable poolId;

    mapping(address => uint) public bammTokenBalance;

    constructor(IERC20 _rewardToken, IERC20 _bammToken, uint _pid) public {
        rewardToken = _rewardToken;
        bammToken = _bammToken;
        poolId = _pid;
    }   

    function deposit(uint256 pid, uint256 amount, address to) external {
        require(poolId == pid, "invalid pool id");
        require(bammToken.transferFrom(msg.sender, address(this), amount));

        bammTokenBalance[to] += amount;
    }

    function withdraw(uint256 pid, uint256 amount, address to) external {
        require(poolId == pid, "invalid pool id");
        require(bammTokenBalance[msg.sender] >= amount);

        bammTokenBalance[msg.sender] -= amount;
        require(bammToken.transfer(to, amount));        
    }

    function harvest(uint256 pid, address to) external {
        require(poolId == pid, "invalid pool id");
        if(bammTokenBalance[msg.sender] == 0) return;

        require(rewardToken.transfer(to, 1));
    }

    function lpToken(uint pid) external view returns(address) {
        require(poolId == pid, "invalid pool id");
        return address(bammToken);
    }
}