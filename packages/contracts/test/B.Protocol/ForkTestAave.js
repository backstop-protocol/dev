const { assert, artifacts } = require("hardhat")
const deploymentHelper = require("./../../utils/deploymentHelpers.js")
const testHelpers = require("./../../utils/testHelpers.js")
const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const CPriceFeed = artifacts.require("CPriceFeed.sol")
const BAMM = artifacts.require("AaveBAMM.sol")
const ForceEthSend = artifacts.require("ForceEthSend.sol")
const MockAave = artifacts.require("MockAave.sol")
const AaveToCToken = artifacts.require("AaveToCTokenAdapter.sol")
const CollateralAdder = artifacts.require("CollateralAdder.sol")
const MockToken = artifacts.require("MockToken")
const FakeChainlink = artifacts.require("ChainlinkTestnet")

const ZERO = toBN('0')
const ZERO_ADDRESS = th.ZERO_ADDRESS
const maxBytes32 = th.maxBytes32

const getFrontEndTag = async (stabilityPool, depositor) => {
  return (await stabilityPool.deposits(depositor))[1]
}

contract('BAMM', async accounts => {
  const [owner,
    defaulter_1, defaulter_2, defaulter_3,
    alice, bob, carol, dennis, erin, flyn,
    A, B, C, D, E, F,
    u1, u2, u3, u4, u5,
    v1, v2, v3, v4, v5,
    frontEnd_1, frontEnd_2, frontEnd_3,
    shmuel, eitan
  ] = accounts;

  let priceFeed

  const lendingPoolAddressesProvider = "0xd05e3E715d945B59290df0ae8eF85c1BdB684744"
  const aWMATIC = "0x8dF3aad3a84da6b69A4DA8aeC3eA40d9091B2Ac4"
  const aDAI = "0x27F8D03b3a2196956ED754baDc28D73be8830A6e"
  const aUSDC = "0x1a13F4Ca1d028320A707D99520AbFefca3998b7F"
  const yaron = "0xDdA7F2654D85653C92513B58305348Da627C7cf0"
  const feePool = yaron

  const daiWhale = aDAI
  const usdcWhale = aUSDC
  const maticWhale = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270"
  const whale = yaron

  const daiAddress = "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063"
  const usdcAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"

  let aaveToCToken
  let cDAI
  let bamm
  let aUSDCToken
  let oracle
  let oracleOwner
  let lendingPool
  let daiPriceOracle
  let usdc
  let dai
  let priceDai2UsdcFeed

  describe("aave test", async () => {

    before(async () => {
      console.log("get lending pool and oracle")
      const provider = await MockAave.at(lendingPoolAddressesProvider)
      lendingPool = await MockAave.at(await provider.getLendingPool())
      oracle = await MockAave.at(await provider.getPriceOracle())
      oracleOwner = await oracle.owner()

      console.log("impersonate accounts")
      await hre.network.provider.request({method: "hardhat_impersonateAccount",params: [whale],})
      await hre.network.provider.request({method: "hardhat_impersonateAccount",params: [daiWhale],})
      await hre.network.provider.request({method: "hardhat_impersonateAccount",params: [usdcWhale],})      
      await hre.network.provider.request({method: "hardhat_impersonateAccount",params: [maticWhale],})
      await hre.network.provider.request({method: "hardhat_impersonateAccount",params: [oracleOwner],})

      console.log("send ether to whales")
      await web3.eth.sendTransaction({from: maticWhale, to: whale, value: toBN(dec(100, 18))})
      await ForceEthSend.new(daiWhale, {from: maticWhale, value: dec(100, 18)})
      await ForceEthSend.new(usdcWhale, {from: maticWhale, value: dec(100, 18)})
      await ForceEthSend.new(oracleOwner, {from: maticWhale, value: dec(100, 18)})      
      
      console.log("send dai to whale")
      dai = await MockToken.at(daiAddress)
      await dai.transfer(whale, dec(1e6, 18), {from: daiWhale})

      console.log("send usdc to whale")
      usdc = await MockToken.at(usdcAddress)
      await usdc.transfer(whale, dec(1e6, 6), {from: usdcWhale})      

      console.log("deploy fake chainlink")
      daiPriceOracle = await FakeChainlink.new()
      console.log("set price of dai to the one of usdc")
      await daiPriceOracle.setPrice(await oracle.getAssetPrice(usdcAddress))
      console.log("set fake price oracle as official price")
      await oracle.setAssetSources([daiAddress], [daiPriceOracle.address], {from: oracleOwner})


      aaveToCToken = await AaveToCToken.new(aUSDC, lendingPoolAddressesProvider, {from: whale})
      console.log("aaveToCToken", aaveToCToken.address)
      console.log("aave to c", aaveToCToken.address)

      bamm = await BAMM.new(aaveToCToken.address,
                            false,
                            400,
                            feePool,
                            {from: whale})

      console.log("bamm address", bamm.address)

      await aaveToCToken.setBAMM(bamm.address, {from: whale})

      aUSDCToken = await MockToken.at(aUSDC)
      
      console.log("Add cdai as collateral")
      cDAI = await MockToken.at(aDAI) //*/await AaveToCToken.new(aDAI, lendingPoolAddressesProvider, {from: whale})
      console.log((await cDAI.decimals()).toString())
 
      // setup a price feed
      console.log("setup price feed")
      priceDai2UsdcFeed = await FakeChainlink.new({from: whale})
      console.log("set price to 2")
      await priceDai2UsdcFeed.setPrice(dec(2,18),{from: whale})
      console.log("add collateral")
      await bamm.addCollateral(cDAI.address, priceDai2UsdcFeed.address, {from: whale})
    })

    beforeEach(async () => {

    })

    it("deposit aUSDC", async () => {
      const amount = toBN(dec(200, 6))
      
      console.log("give usdc allowance to lending pool")
      await usdc.approve(lendingPool.address, amount, {from: whale})

      console.log("deposit in lending pool")
      await lendingPool.deposit(usdc.address, amount, whale, 0, {from: whale})

      console.log("giving allowance of atokn")
      await aUSDCToken.approve(aaveToCToken.address, amount, {from: whale})

      console.log("depositing")
      const balanceBefore = await aUSDCToken.balanceOf(whale)
      await bamm.deposit(amount, {from: whale})
      const balanceAfter = await aUSDCToken.balanceOf(whale)

      assert.equal((await aUSDCToken.balanceOf(bamm.address)).toString(), amount.toString())
      assert.equal(toBN(balanceBefore).sub(balanceAfter).toString(), amount.toString())

      console.log("withdrawing")
      await bamm.withdraw(toBN(dec(1,18)).div(toBN(2)), {from: whale})
      const balanceAfterWithdraw = await aUSDCToken.balanceOf(whale)

      assert(in100WeiRadius((await aUSDCToken.balanceOf(bamm.address)).toString(), amount.div(toBN(2)).toString()))
      assert(in100WeiRadius(toBN(balanceAfterWithdraw).sub(balanceAfter).toString(), amount.div(toBN(2)).toString()))
    })

    it("borrow usdc and get liquidated", async () => {
      const joe = (await ForceEthSend.new(whale)).address // fresh new address
      const daiAmount = dec(50, 18)

      console.log("impersonate accounts")
      await hre.network.provider.request({method: "hardhat_impersonateAccount",params: [joe],})

      console.log("send ether to joe")
      await web3.eth.sendTransaction({from: maticWhale, to: joe, value: toBN(dec(100, 18))})
      
      console.log("send dai to whale")
      await dai.transfer(joe, daiAmount, {from: daiWhale})

      console.log("give dai allowance to lending pool")
      await dai.approve(lendingPool.address, daiAmount, {from: joe})
      console.log("deposit into pool")
      await lendingPool.deposit(dai.address, daiAmount, joe, 0, {from: joe})

      const usdcDebtAmount = dec(10, 6)
      await lendingPool.borrow(usdc.address, usdcDebtAmount, 2, 0, joe, {from: joe})

      console.log("set dai price oracle to low number")
      const lowPrice = toBN(await oracle.getAssetPrice(usdcAddress)).div(toBN(10))
      await daiPriceOracle.setPrice(lowPrice.toString())

      console.log("calling liquidate borrow")
      const debtToLiquidate = dec(1, 6)
      const expectedLiquidationProceeds = dec(105, 17) // 1 usdc = 10 dai + 5% premium
      await bamm.liquidateBorrow(joe, debtToLiquidate, cDAI.address, {from: whale})
      const aDAIToken = await MockToken.at(aDAI)
      assert(inWeiRadius((await aDAIToken.balanceOf(bamm.address)).toString(), expectedLiquidationProceeds.toString(), 1e6))

      console.log("done")
    })

    it("swap", async () => {
      console.log("set price feed")
      // set 1 dai = 1 usdc
      await priceDai2UsdcFeed.setPrice(dec(1, 18), {from: whale})

      console.log("mint 1 usdc token")
      const oneUSDC = dec(1, 6)
      await usdc.approve(lendingPool.address, oneUSDC, {from: whale})
      await lendingPool.deposit(usdcAddress, oneUSDC, whale, 0, {from: whale})

      console.log("giving allowance of atokn")
      await aUSDCToken.approve(aaveToCToken.address, oneUSDC, {from: whale})

      // swap
      console.log("swap usdc to dai")
      console.log("fetch price", (await bamm.fetchPrice(cDAI.address)).toString())
      console.log("dai balance", (await cDAI.balanceOf(bamm.address)).toString())
      const expectedSwapReturn = await bamm.getSwapAmount(oneUSDC, cDAI.address)
      console.log("expected return", expectedSwapReturn.toString())

      const newAddress = (await ForceEthSend.new(whale)).address

      await bamm.swap(oneUSDC, cDAI.address, 1, newAddress, "0x", {from: whale})

      console.log("alice balance", (await cDAI.balanceOf(newAddress)).toString())
      assert.equal((await cDAI.balanceOf(newAddress)).toString(), expectedSwapReturn.toString())
    })

    it("withdraw all", async () => {
      const whaleBammBalance = await bamm.balanceOf(whale)

      const aUSDCBalBefore = await aUSDCToken.balanceOf(whale)
      const aDaiBalBefore = await cDAI.balanceOf(whale)

      const bammUSDCBalance = await aUSDCToken.balanceOf(bamm.address)
      const bammDaiBalance = await cDAI.balanceOf(bamm.address)

      await bamm.withdraw(whaleBammBalance, {from: whale})

      const aUSDCBalAfter = await aUSDCToken.balanceOf(whale)
      const aDaiBalAfter = await cDAI.balanceOf(whale)      

      assert(in100WeiRadius(toBN(aUSDCBalAfter).sub(toBN(aUSDCBalBefore)), bammUSDCBalance))
      assert(inWeiRadius(toBN(aDaiBalAfter).sub(toBN(aDaiBalBefore)).toString(), toBN(bammDaiBalance).toString(), 1e10))      
    })
  })
})


// TODO - use atoken as collateral. not ctoken.

function almostTheSame(n1, n2) {
  n1 = Number(web3.utils.fromWei(n1))
  n2 = Number(web3.utils.fromWei(n2))
  //console.log(n1,n2)

  if(n1 * 1000 > n2 * 1001) return false
  if(n2 * 1000 > n1 * 1001) return false  
  return true
}

function in100WeiRadius(n1, n2) {
  const x = toBN(n1)
  const y = toBN(n2)

  if(x.add(toBN(100)).lt(y)) return false
  if(y.add(toBN(100)).lt(x)) return false  
 
  return true
}

function inWeiRadius(n1, n2, wei) {
  //console.log({n1}, {n2}, {wei})
  const x = toBN(n1)
  const y = toBN(n2)

  if(x.add(toBN(wei)).lt(y)) {
    console.log("inWeiRadius:", x.toString(), y.toString())
    return false
  }
  if(y.add(toBN(wei)).lt(x)) {
    console.log("inWeiRadius:", x.toString(), y.toString())    
    return false
  }
 
  return true
}

async function assertRevert(txPromise, message = undefined) {
  try {
    const tx = await txPromise
    // console.log("tx succeeded")
    assert.isFalse(tx.receipt.status) // when this assert fails, the expected revert didn't occur, i.e. the tx succeeded
  } catch (err) {
    // console.log("tx failed")
    assert.include(err.message, "revert")
    
    if (message) {
       assert.include(err.message, message)
    }
  }
}
