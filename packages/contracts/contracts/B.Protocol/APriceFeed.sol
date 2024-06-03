// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

interface BAMMLike {
    function cBorrow() external view returns(address);
}

interface AaveOracleLike {
    function getAssetPrice(address underlying) external view returns (uint);
}

interface AaveLendingPoolAddressesProviderLike {
    function getPriceOracle() view external returns(AaveOracleLike);
}

interface AaveToCTokenAdapterLike {
    function underlying() external view returns (address);
    function decimals() external view returns(uint);
}

interface APriceFeedLike {
    function decimals() view external returns(uint);
    function getPriceFromBamm(address sender, address dst) view external returns(uint);
}

interface IAToken {
    function UNDERLYING_ASSET_ADDRESS() view external returns(address);
    function decimals() external view returns(uint);    
}

contract ADegenFeed {
    APriceFeedLike immutable priceFeed;
    address immutable ctoken;

    constructor(address _priceFeed, address _ctoken) public {
        priceFeed = APriceFeedLike(_priceFeed);
        ctoken = _ctoken;
    }

    function decimals() view public returns(uint) {
        return priceFeed.decimals();
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
        answer = int(priceFeed.getPriceFromBamm(msg.sender, ctoken));
        timestamp = block.timestamp;
    }
}
/*
price feed for ctokens. a single feed for all ctokens.
*/
contract APriceFeed {
    AaveLendingPoolAddressesProviderLike immutable provider;
    uint public constant decimals = 18;

    constructor(AaveLendingPoolAddressesProviderLike _provider) public {
        provider = _provider;
    }

    function getPrice(address src, address dst) public view returns(uint) {
        AaveOracleLike oracle = provider.getPriceOracle();
        
        address underlyingSrc = AaveToCTokenAdapterLike(src).underlying();
        address underlyingDst = IAToken(dst).UNDERLYING_ASSET_ADDRESS();

        uint srcUnderlyingPrice = oracle.getAssetPrice(underlyingSrc);
        uint dstUnderlyingPrice = oracle.getAssetPrice(underlyingDst);

        uint price = (10 ** decimals) * dstUnderlyingPrice / srcUnderlyingPrice;


        return price;
    }

    function getPriceFromBamm(address sender, address dst) public view returns(uint) {
        address src = BAMMLike(sender).cBorrow();
        return getPrice(src, dst);
    }

    function generateDegenFeed(address dstCToken) public returns(address) {
        ADegenFeed degenFeed =  new ADegenFeed(address(this), dstCToken);
        return address(degenFeed);
    }
}



