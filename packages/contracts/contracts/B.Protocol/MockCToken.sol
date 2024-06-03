
// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./../Dependencies/IERC20.sol";
import "./MockToken.sol";

contract MockCToken is TokenAdapter2 {
    IERC20 token;
    bool isEth;    
    uint price;
    uint public exchangeRate = 1e18;
    uint errorVal = 0;

    constructor (IERC20 _token, bool _isETH) public {
        token = _token;
        isEth = _isETH;
        decimals = 8;
    }

    function underlying() external view returns(IERC20) {
        require(! isEth, "underlying: unsupported");
        return token;
    }

    function redeem(uint redeemTokens) public returns (uint) {
        require(balanceOf[msg.sender] >= redeemTokens, "redeem: insufficient ballance");
        
        if(isEth) msg.sender.transfer(redeemTokens);
        else token.transfer(msg.sender, redeemTokens);

        balanceOf[msg.sender] -= redeemTokens;
    }

    function balanceOfUnderlying(address account) external returns (uint) {
        return balanceOf[account] * exchangeRate / 1e18;
    }

    function setErrorVal(uint _val) external {
        errorVal = _val;
    }

    function getAccountSnapshot(address account)
        external
        view
        returns(uint err, uint cTokenBalance, uint borrowBalance, uint exchangeRateMantissa)
    {
        return (errorVal, balanceOf[account], 0, exchangeRate);
    }    

    function redeemUnderlying(uint redeemAmount) external returns (uint) {
        uint ctokenAmount = (redeemAmount * 1e18 + (exchangeRate - 1)) / exchangeRate;
        redeem(ctokenAmount);
    }

    function exchangeRateCurrent() external returns(uint) {
        return exchangeRate;
    }
        
    function depositToken(uint amount) public returns(uint) {
        require(!isEth, "depositToken: failed only ETH can be deposited use depositEther");
        token.transferFrom(msg.sender, address(this), amount);

        uint normAmount = amount * 1e18 / exchangeRate;

        balanceOf[msg.sender] += normAmount;

        return normAmount;
    }

    function depositEther() public payable returns(uint) {
        require(isEth, "depositEther: failed only ERC20 can be deposited use depositToken");

        uint normAmount = msg.value * 1e18 / exchangeRate;

        balanceOf[msg.sender] += normAmount;

        return normAmount;
    }


    function setPrice(uint _price) public {
        price = _price;
    }

    function setExchangeRate(uint _rate) public {
        exchangeRate = _rate;
    }

    function getCash() public view returns(uint) {
        if(isEth) return address(this).balance;
        return token.balanceOf(address(this));
    }

    function borrow(uint amount) public {
        if(isEth) msg.sender.transfer(amount);
        else token.transfer(msg.sender, amount);
    }

    function liquidateBorrow(address borrower, uint amount, MockCToken collateral) external returns (uint) {
        require(! isEth, "can't liquidate ETH");
        token.transferFrom(msg.sender, address(this), amount);
        collateral.transfer(borrower, msg.sender, amount * price / 1e18);
    }

    function liquidateBorrow(address borrower, MockCToken collateral) external payable returns (uint) {
        require(isEth, "can't liquidate non ETH");
        uint amount = msg.value;
        collateral.transfer(borrower, msg.sender, amount * price / 1e18);
    }

    function transfer(address from, address to, uint amount) public {
        require(balanceOf[from] >= amount, "transfer: insufficient ballance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }

    // fake stuff for fuse
    function comptroller() external view returns(address) {
        return address(this);
    }

    function admin() external view returns(address) {
        return address(this);
    }

    function _setSeizePaused(bool state) external returns (bool) {
        return true;
    }

    function mint() public payable {
        depositEther();
    }

    function mint(uint amount) public returns(uint) {
        depositToken(amount);
        return 0;
    }
}

contract MockUnitroller {
    function getAllMarkets() public view returns(address[] memory) {

    }
}


contract MockAave {
    function getLendingPool() external pure returns (address) {
        return address(0);
    }

    function getPriceOracle() external pure returns (address) {
        return address(0);
    }

    function deposit(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external
    {

    }

    function borrow(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint16 referralCode,
        address onBehalfOf
    ) external
    {

    }

    function setAssetSources(address[] calldata assets, address[] calldata sources)
        external
    {

    }

    function owner() external pure returns(address) {
        return address(0);
    }

    function getAssetPrice(address asset) external pure returns(uint) {
        return 8;
    }
}

contract ForceEthSend {
    constructor(address payable dest) public payable {
        selfdestruct(dest);
    }
}