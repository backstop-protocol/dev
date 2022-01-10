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

contract NonUSDOracle {
    AggregatorV3Interface immutable public srcOracle;
    AggregatorV3Interface immutable public targetOracle;

    constructor(AggregatorV3Interface _srcOracle, AggregatorV3Interface _targetOracle) public {
        srcOracle = _srcOracle;
        targetOracle = _targetOracle;
    }

    function decimals() public view returns (uint8) {
        return targetOracle.decimals();
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
        int targetAnswer;
        int srcAnswer;
        uint targetTimestamp;
        uint srcTimestamp;

        (roundId, targetAnswer, startedAt, targetTimestamp, answeredInRound) = targetOracle.latestRoundData();
        (, srcAnswer, , srcTimestamp,) = srcOracle.latestRoundData();

        uint srcDecimals = srcOracle.decimals();

        answer = targetAnswer * int(10 ** srcDecimals) / srcAnswer;
        timestamp = srcTimestamp > targetTimestamp ? targetTimestamp : srcTimestamp; // take the minimum

        // check if there was an overflow in calculation - if there was, return 0 timestamp and answer
        bool overflow = false;
        if(targetAnswer > type(int128).max) overflow = true;
        if(srcDecimals > 18) overflow = true;

        if(overflow) {
            timestamp = 0;
            answer = 0;
        }
    }
}

contract FixedOracle {
    function decimals() public pure returns (uint8) {
        return 8;
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
        roundId = 5;
        answer = 1e8;
        startedAt = now;
        timestamp = now;
        answeredInRound = 5;
   }
}