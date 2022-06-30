// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";

contract UniV3Twap {
    address constant LQTY = 0x6DEA81C8171D0bA574754EF6F8b412F2Ed88c54D;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant UNI_POOL = 0xD1D5A4c0eA98971894772Dcd6D2f1dc71083C44E;
    uint32 immutable twapDuration;

    constructor(uint32 _twapDuration) public {
        // NOTE!!! need to make sure (off chain) that sufficient amount of slots were intialized
        twapDuration = _twapDuration;
    }

    function decimals() public pure returns(uint8) {
        return 18;
    }

    function latestRoundData() public view returns
    (
        uint80 /* roundId */,
        int256 answer,
        uint256 /* startedAt */,
        uint256 timestamp,
        uint80 /* answeredInRound */
    )
    {
        (int24 arithmeticMeanTick, ) = OracleLibrary.consult(UNI_POOL, twapDuration);
        uint128 baseUnit = 1e18;
        uint256 quote = OracleLibrary.getQuoteAtTick(
            arithmeticMeanTick,
            baseUnit,
            LQTY,
            WETH
        );

        answer = int(quote);
        timestamp = now;
    }    
}