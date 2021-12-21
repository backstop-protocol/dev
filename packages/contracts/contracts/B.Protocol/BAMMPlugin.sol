// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

// Rari's CLusd BAMM - collateral-only - Plugin

import "./DegenTokenWrapper.sol";

contract BAMMPlugin {
    using SafeMath for uint256;

    DegenTokenWrapper public immutable token;
    address public immutable lqty;
    address public immutable cToken;

    modifier onlyCToken {
        require(msg.sender == cToken, "onlyCToken");
        _;
    }

    constructor(address _cToken, DegenTokenWrapper _token) public {
        cToken = _cToken;
        lqty = address(_token.bamm().bonus());
        token = _token;
    }

    function getCash() external pure returns (uint) {
        return 0; // cannot borrow degen token
    }

    function rewardToken() external view returns (address) {
        return lqty;
    }

    function transferPlugin(address /* newPlugin */) external view onlyCToken {
        revert("transferPlugin: transfer sequence should be done by ctoken");
    }

    function deposit(uint /* amount */) external view onlyCToken {
        // nothing to do
    }

    function withdraw(
        address payable to,
        uint amount
    ) external onlyCToken {
        require(token.transfer(to, amount), "withdraw: token transfer failed");
    }

    function claim() external {
        token.claimLqty(cToken);
    }    


}