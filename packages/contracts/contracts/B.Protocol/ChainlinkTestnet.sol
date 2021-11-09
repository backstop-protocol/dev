// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./../TestContracts/PriceFeedTestnet.sol";

/*
* PriceFeed placeholder for testnet and development. The price is simply set manually and saved in a state 
* variable. The contract does not connect to a live Chainlink price feed. 
*/
contract ChainlinkTestnet {
    
    PriceFeedTestnet feed;
    uint time = 0;

    constructor(PriceFeedTestnet _feed) public {
        feed = _feed;
    }

    function decimals() external pure returns(uint) {
        return 18;
    }

    function setTimestamp(uint _time) external {
        time = _time;
    }

    function latestRoundData() external view returns
     (
        uint80 /* roundId */,
        int256 answer,
        uint256 /* startedAt */,
        uint256 timestamp,
        uint80 /* answeredInRound */
    )
    {
        answer = int(feed.getPrice());
        if(time == 0 ) timestamp = now;
        else timestamp = time;
    }
}

contract FakePriceOracle {
    address cETH;
    address realOracle;
    uint cETHPrice;

    constructor(address _cETH, address _realOracle) public {
        cETH = _cETH;
        realOracle = _realOracle;
    }

    function setCETHPrice(uint _price) public {
        cETHPrice = _price;
    }

    function getUnderlyingPrice(address ctoken) public returns(uint) {
        if(ctoken == cETH) return cETHPrice;
        return FakePriceOracle(realOracle).getUnderlyingPrice(ctoken);
    }
}
