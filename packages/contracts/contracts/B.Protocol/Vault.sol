pragma solidity ^0.6.11;

import "./../Dependencies/Ownable.sol";

// initially deployer owns it, and then it moves it to the DAO
contract FeeVault is Ownable {
    constructor(address owner) public {
        transferOwnership(owner);
    }

    function op(address payable target, bytes calldata data, uint value) onlyOwner external payable {
        target.call.value(value)(data);
    }
    receive() payable external {}
}