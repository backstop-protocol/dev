// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./../Dependencies/Ownable.sol";

interface WithAdmin {
    function admin() external view returns(address);
}

interface BAMMLikeInterface {
    function setParams(uint _A, uint _fee, uint _callerFee) external;
    function transferOwnership(address _newOwner) external;
}

contract Admin is Ownable {
    WithAdmin public immutable comptroller;
    BAMMLikeInterface public immutable bamm;
    
    address public pendingOwner;
    uint public ttl;

    event PendingOwnerAlert(address newOwner);

    constructor(WithAdmin _comptroller, BAMMLikeInterface _bamm) public {
        comptroller = _comptroller;
        bamm = _bamm;
    }

    function setParams(uint _A, uint _fee, uint _callerFee) public onlyOwner {
        bamm.setParams(_A, _fee, _callerFee);
    }

    function setBAMMPendingOwnership(address newOwner) public {
        require(msg.sender == comptroller.admin(), "only market admin can change ownership");
        pendingOwner = newOwner;
        ttl = now + 14 days;

        emit PendingOwnerAlert(newOwner);
    }

    function transferBAMMOwnership() public onlyOwner {
        require(pendingOwner != address(0), "pending owner is 0");
        require(now >= ttl, "too early");

        bamm.transferOwnership(pendingOwner);

        pendingOwner = address(0);
    }
}