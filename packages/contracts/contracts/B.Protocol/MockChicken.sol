// SPDX-License-Identifier: MIT
import "./BAMM.sol";

pragma solidity 0.6.11;

contract MockChicken {
    uint public getTotalLUSDInCurve;

    function setLUSDInCurve(uint val) external {
        getTotalLUSDInCurve = val;
    }

    function deposit(uint amount, BAMM bamm) external {
        IERC20(bamm.LUSD()).approve(address(bamm), amount);
        bamm.deposit(amount);
    }

    function withdraw(uint amount, BAMM bamm, address to) external {
        bamm.withdraw(amount, to);
    }
}