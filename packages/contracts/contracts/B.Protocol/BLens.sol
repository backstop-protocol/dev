// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

import "./BAMM.sol";


contract BLens {
    function add(uint256 x, uint256 y) public pure returns (uint256 z) {
        require((z = x + y) >= x, "ds-math-add-overflow");
    }
    function sub(uint256 x, uint256 y) public pure returns (uint256 z) {
        require((z = x - y) <= x, "ds-math-sub-underflow");
    }
    function mul(uint256 x, uint256 y) public pure returns (uint256 z) {
        require(y == 0 || (z = x * y) / y == x, "ds-math-mul-overflow");
    }
    function divup(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = add(x, sub(y, 1)) / y;
    }
    uint256 constant WAD  = 10 ** 18;
    function wmul(uint256 x, uint256 y) public pure returns (uint256 z) {
        z = mul(x, y) / WAD;
    }
    function wdiv(uint256 x, uint256 y) public pure returns (uint256 z) {
        z = mul(x, WAD) / y;
    }
    function wdivup(uint256 x, uint256 y) public pure returns (uint256 z) {
        z = divup(mul(x, WAD), y);
    }
    uint256 constant RAY  = 10 ** 27;
    function rmul(uint256 x, uint256 y) public pure returns (uint256 z) {
        z = mul(x, y) / RAY;
    }
    function rmulup(uint256 x, uint256 y) public pure returns (uint256 z) {
        z = divup(mul(x, y), RAY);
    }
    function rdiv(uint256 x, uint256 y) public pure returns (uint256 z) {
        z = mul(x, RAY) / y;
    }

    struct UserInfo {
        uint bammUserBalance;
        uint bammTotalSupply;

        uint lusdUserBalance;
        uint ethUserBalance;

        uint lusdTotal;
        uint ethTotal;
    }

    function getUserInfo(address user, BAMM bamm) external view returns(UserInfo memory info) {
        info.bammUserBalance = bamm.balanceOf(user);
        info.bammTotalSupply = bamm.totalSupply();
        
        info.lusdTotal = bamm.LUSD().balanceOf(address(bamm));
        info.ethTotal = address(bamm).balance;

        info.lusdUserBalance = info.lusdTotal * info.bammUserBalance / info.bammTotalSupply;
        info.ethUserBalance = info.ethTotal * info.bammUserBalance / info.bammTotalSupply;        
    }
}
