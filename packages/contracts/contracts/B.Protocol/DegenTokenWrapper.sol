// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./TokenAdapter.sol";
import "./BAMM.sol";

contract DegenTokenWrapper is TokenAdapter, Ownable {
    using SafeMath for uint256;

    BAMM public immutable bamm;
    IERC20 public immutable lqty;
    IERC20 public immutable lusd;
    StabilityPool immutable public SP;

    address public plugin;

    constructor(BAMM _bamm) public {
        bamm = _bamm;
        lusd = _bamm.LUSD();
        lqty = IERC20(address(_bamm.bonus()));
        SP = _bamm.SP();

        // Approve moving all LUSD into the BAMM contract.
        _bamm.LUSD().approve(address(_bamm), type(uint256).max);
    }

    function setPlugin(address _plugin) external {
        plugin = _plugin;
    }

    function mintDegenToken(uint lusdAmount) external {
        lusd.transferFrom(msg.sender, address(this), lusdAmount);

        uint balBefore = bamm.balanceOf(address(this));
        bamm.deposit(lusdAmount);
        uint balAfter = bamm.balanceOf(address(this));

        mint(msg.sender, balAfter.sub(balBefore));
    }

    function burnDegenToken(uint amount) external {
        burn(msg.sender, amount);
        bamm.withdraw(amount);

        lusd.transfer(msg.sender, lusd.balanceOf(address(lusd)));
        uint ethAmount = address(this).balance;

        if(ethAmount > 0) {
            (bool success, ) = msg.sender.call{ value: ethAmount }(""); // re-entry is fine here
            require(success, "withdraw: sending ETH failed");
        }
    }

    function claimLqty(address to) external {
        require(msg.sender == plugin, "only plugin can claim");
        bamm.withdraw(0);
        lqty.transfer(to, lqty.balanceOf(address(this)));
    }

    receive () external payable {} // contract should be able to receive ETH    
}