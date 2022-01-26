// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./BAMM.sol";

interface FeePoolVaultLike {
    function op(address target, bytes calldata data, uint value) external;
    function transferOwnership(address newOwner) external;
}


contract KeeperRebate is Ownable {
    address immutable public feePool;
    BAMM immutable public bamm;
    IERC20 immutable public lusd;
    mapping(address => bool) keepers;
    address public keeperLister;

    event Swap(address indexed keeper, uint lusdInAmount, uint ethRetAmount, uint lusdRebate);
    event NewLister(address lister);
    event KeeperListing(address keeper, bool list);

    constructor(BAMM _bamm) public {
        bamm = _bamm;
        lusd = _bamm.LUSD();
        feePool = _bamm.feePool();

        IERC20(_bamm.LUSD()).approve(address(_bamm), uint(-1));
    }

    function getReturnedSwapAmount(uint lusdQty) public view returns(uint ethAmount, uint lusdRebate) {
        (ethAmount, lusdRebate) = bamm.getSwapEthAmount(lusdQty);
    }

    function swapWithRebate(uint lusdAmount, uint minEthReturn, address payable dest)
        public
        returns(uint ethAmount, uint lusdRebate)
    {
        require(keepers[msg.sender], "swapWithRebate: !keeper");
        lusd.transferFrom(msg.sender, address(this), lusdAmount);

        uint feeBps = bamm.fee();
        // if lusd amount is 0 it will revert, but this is fine
        require(feeBps * lusdAmount / lusdAmount == feeBps, "swapWithRebate: overflow");
        lusdRebate = feeBps * lusdAmount / 10000;

        ethAmount = bamm.swap(lusdAmount, minEthReturn, dest);

        rebate(dest, lusdRebate);

        emit Swap(msg.sender, lusdAmount, ethAmount, lusdRebate);
    }

    function rebate(address payable dest, uint amount) internal {
        bytes memory data = abi.encodeWithSignature("transfer(address,uint256)", dest, amount);
        FeePoolVaultLike(feePool).op(address(lusd), data, 0);
    }

    function transferFeePoolOwnership(address newOwner) public onlyOwner {
        FeePoolVaultLike(feePool).transferOwnership(newOwner);
    }

    function setKeeperLister(address lister) public onlyOwner {
        keeperLister = lister;
        emit NewLister(lister);
    }
    
    function listKeeper(address keeper, bool list) public {
        require(msg.sender == keeperLister, "listKeeper: !lister");
        keepers[keeper] = list;
        KeeperListing(keeper, list);
    }
}