// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./../Dependencies/AggregatorV3Interface.sol";

contract StableOralce {
    AggregatorV3Interface immutable oracle;

    constructor(AggregatorV3Interface _oracle) public {
        oracle = _oracle;
    }

    function decimals() public view returns (uint8) {
        return oracle.decimals();
    }

    function latestRoundData() public view
        returns
        (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 timestamp,
            uint80 answeredInRound
        )
    {
        (roundId, answer, startedAt, timestamp, answeredInRound) = oracle.latestRoundData();
        timestamp = now; // override timestamp
    }
}