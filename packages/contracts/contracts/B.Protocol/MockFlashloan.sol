// SPDX-License-Identifier: MIT
import "./BAMM.sol";

pragma solidity 0.6.11;

contract FlashswapStub {
    address public initiator;
    uint public lusdAmount;
    uint public returnAmount;
    bytes public data;

    function bammFlashswap(address _initiator, uint _lusdAmount, uint _returnAmount, bytes memory _data) external {
        initiator = _initiator;
        lusdAmount = _lusdAmount;
        returnAmount = _returnAmount;
        data = _data;
    }
}

contract FlashswapHonest {
    BAMM bamm;
    address to;

    constructor(address payable _bamm, address _to) public {
        bamm = BAMM(_bamm);
        to = _to;
    }

    function bammFlashswap(address /*_initiator*/, uint _lusdAmount, uint /*_returnAmount*/, bytes memory /*_data*/) external {
        IERC20 lusd = IERC20(bamm.LUSD());
        lusd.transfer(to, _lusdAmount);
    }
}

contract FlashswapMalicious {
    address public bamm;
    bytes public data;

    constructor(address _bamm) public {
        bamm = _bamm;
    }

    fallback() external {
        data = msg.data;
    }

    function bammFlashswap(address /*_initiator*/, uint /*_lusdAmount*/, uint /*_returnAmount*/, bytes memory /*_data*/) external {
        (bool succ, bytes memory err) = bamm.call(data);
        require(succ, string(err));
    }
}