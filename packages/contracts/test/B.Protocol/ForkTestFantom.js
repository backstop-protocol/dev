const { assert } = require("hardhat")
const deploymentHelper = require("./../../utils/deploymentHelpers.js")
const testHelpers = require("./../../utils/testHelpers.js")
const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const TroveManagerTester = artifacts.require("TroveManagerTester")
const MockToken = artifacts.require("MockToken")
const MockCToken = artifacts.require("MockCToken")
const NonPayable = artifacts.require('NonPayable.sol')
const BAMM = artifacts.require("BAMM.sol")
const BLens = artifacts.require("BLens.sol")
const Comptroller = artifacts.require("Comptroller.sol")
const Unitroller = artifacts.require("Unitroller.sol")
const ChainlinkTestnet = artifacts.require("ChainlinkTestnet.sol")
const CErc20Interface = artifacts.require("CErc20Interface.sol")
const CETH = artifacts.require("CETH.sol")
const FakePrice = artifacts.require("FakePriceOracle.sol")

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
    bammOwner, 
    shmuel, yaron, eitan
  ] = accounts;

  const fvat = "0xD0Bb8e4E4Dd5FDCD5D54f78263F5Ec8f33da4C95"
  const whale = "0x2400BB4D7221bA530Daee061D5Afe219E9223Eae" // has eth and usdt
  const fish = "0x23cBF6d1b738423365c6930F075Ed6feEF7d14f3" // has cETH and usdt debt

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3]
  let contracts
  let priceFeed
  let lusdToken
  let bamm
  let lens
  let chainlink
  let usdc
  let btc
  let cBTC
  let cUSDC
  let fakePrice

  let gasPriceInWei

  const cBTCAddress = "0xa8236EaFBAF1C3D39396DE566cEEa6F320E3db00"
  const BTCAddress = "0x321162Cd933E2Be498Cd2267a90534A804051b11"
  const cUSDCAddress = "0x243E33aa7f6787154a8E59d3C27a66db3F8818ee"
  const USDCAddress = "0x04068DA6C83AFCFA0e13ba15A6696662335D5B75"

  //const assertRevert = th.assertRevert

  describe("BAMM", async () => {

    before(async () => {
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [fvat], 
      })

      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [whale], 
      })

      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [fish], 
      })

      usdc = await MockToken.at(USDCAddress)
      btc = await MockToken.at(BTCAddress)
      cBTC = await CErc20Interface.at(cBTCAddress)
      cUSDC = await CErc20Interface.at(cUSDCAddress)      

      console.log("send eth to fish")
      await web3.eth.sendTransaction({from: whale, to: fish, value: toBN(dec(1, 18))})

      console.log("send ust to fish")
      await usdc.transfer(fish, dec(1000,6), {from: whale, block: "latest"})

      bamm = await BAMM.at("0xEDC7905a491fF335685e2F2F1552541705138A3D")
    })

    beforeEach(async () => {

    })

    it("liquidate with b.protocol happy path", async () => {
      const unicomptroller = await Comptroller.at("0x0F390559F258eB8591C8e31Cf0905E97cf36ACE2")
      const unitroller = await Unitroller.at("0x0F390559F258eB8591C8e31Cf0905E97cf36ACE2")

      console.log("enter market")
      await unicomptroller.enterMarkets([cBTC.address], {from: whale, block: "latest"})
      console.log("give wbtc allowance")
      await btc.approve(cBTC.address, dec(1, 8), {from: whale, block: "latest"})
      console.log("deposit cWBTC")
      await cBTC.mint(dec(1,8), {from: whale, block: "latest"})
      console.log("whale balance:", (await usdc.balanceOf(whale)).toString())
      await cUSDC.borrow(dec(20000,6), {from: whale, block: "latest"})
      console.log("whale balance:", (await usdc.balanceOf(whale)).toString())            

      console.log("deploying fake price")
      fakePrice = await FakePrice.new(cBTCAddress, "0x10010069DE6bD5408A6dEd075Cf6ae2498073c73", {from: fvat})

      console.log("setting new price oracle")
      await unicomptroller._setPriceOracle(fakePrice.address, {from: fvat, block: "latest"})

      console.log("setting new eth price")
      await fakePrice.setCETHPrice(dec(1000, 28), {from: fvat})

      console.log((await web3.eth.getBlockNumber()).toString())

      console.log("deploying impl")
      const comptrollerImpl = await Comptroller.new({from: fvat, block: "latest"})
      console.log("deploying impl done")


      console.log("setting new pending impl")
      await unitroller._setPendingImplementation(comptrollerImpl.address, {from: fvat, block: "latest"})
      console.log("setting new pending impl done")

      console.log("accept new implementation")
      await comptrollerImpl._become(unitroller.address, {from: fvat, block: "latest"})
      console.log("accept new implementation done")

      console.log("bamm address", bamm.address)

      console.log("set b.protocol")
      await unicomptroller._setBProtocol(cUSDCAddress, bamm.address, {from: fvat, block: "latest"})
      console.log("set b.protocol - done")

      console.log("give allowance to bamm")
      await usdc.approve(bamm.address, dec(1000, 6), {from: whale, block: "latest"})

      console.log("whale balance:", (await usdc.balanceOf(whale)).toString())

      console.log("deposit usdt to bamm")
      await bamm.deposit(dec(1000, 6), {from: whale, block: "latest"})
      console.log("deposit done")

      console.log("liquidate")
      const ethBalBefore = await btc.balanceOf(bamm.address)
      const usdtBalBefore = await usdc.balanceOf(bamm.address)

      console.log("eth balance before", ethBalBefore.toString())
      console.log("ust balance before", (await usdc.balanceOf(bamm.address)).toString())

      await assertRevert(cUSDC.liquidateBorrow(whale, dec(100,6), cBTCAddress, {from: fish, block: "latest"}), 'only B.Protocol can liquidate')

      await bamm.liquidateBorrow(whale, dec(100,6), cBTCAddress, {from: whale, block: "latest"})

      const ethBalAfter = await btc.balanceOf(bamm.address)
      const usdtBalAfter = await usdc.balanceOf(bamm.address)

      console.log("eth balance after", ethBalAfter.toString())
      console.log("ust balance before", (await usdc.balanceOf(bamm.address)).toString())

      assert.equal(usdtBalBefore.sub(usdtBalAfter).toString(), dec(100,6), "unexpect ust bal diff")
      assert.equal(ethBalAfter.sub(ethBalBefore).toString(), (10691307 - 258), "unexpect ust btc diff")      
    })

    it("try to set bprotocol from non owner", async () => {
      const unicomptroller = await Comptroller.at("0x0F390559F258eB8591C8e31Cf0905E97cf36ACE2")
      await assertRevert(unicomptroller._setBProtocol(cUSDCAddress, bamm.address, {from: fish}), "only admin can set B.Protocol")
    })

    it("liquidate without b.protocol - b.protocol not set", async () => {
      const unicomptroller = await Comptroller.at("0x0F390559F258eB8591C8e31Cf0905E97cf36ACE2")
      const unitroller = await Unitroller.at("0x0F390559F258eB8591C8e31Cf0905E97cf36ACE2")

      console.log("set b.protocol")
      await unicomptroller._setBProtocol(cUSDCAddress, "0x0000000000000000000000000000000000000000", {from: fvat, block: "latest"})
      // set something but not for this ctoken
      await unicomptroller._setBProtocol(fvat, fvat, {from: fvat, block: "latest"})      
      console.log("set b.protocol - done")

      console.log("whale balance:", (await usdc.balanceOf(whale)).toString())

      console.log("liquidate")
      const usdtBalBefore = await usdc.balanceOf(fish)
      console.log("ust balance before", (await usdc.balanceOf(fish)).toString())
      await usdc.approve(cUSDC.address, dec(1,6), {from: fish, block: "latest"})      
      console.log((await cUSDC.liquidateBorrow.call(whale, dec(1,6), cBTCAddress, {from: fish, block: "latest"})).toString())
      await cUSDC.liquidateBorrow(whale, dec(1,6), cBTCAddress, {from: fish, block: "latest"})
      const usdtBalAfter = await usdc.balanceOf(fish)      
      console.log("ust balance after", (await usdc.balanceOf(fish)).toString())

      assert.equal(usdtBalBefore.sub(usdtBalAfter).toString(), dec(1,6), "unexpect ust bal diff")
    })

    it.skip("liquidate without b.protocol - b.protocol can liquidate return false", async () => {
      const unicomptroller = await Comptroller.at("0x0F390559F258eB8591C8e31Cf0905E97cf36ACE2")
      const unitroller = await Unitroller.at("0x0F390559F258eB8591C8e31Cf0905E97cf36ACE2")

      console.log("set b.protocol")
      await unicomptroller._setBProtocol(cUSDCAddress, bamm.address, {from: fvat, block: "latest"})
      assert.equal(await unicomptroller.bprotocol(cUSDCAddress), bamm.address, "unexpected b.protocol address")
      console.log("set b.protocol - done")

      console.log("withdraw all bamm balance")
      await bamm.withdraw(await bamm.balanceOf(whale), {from: whale, block: "latest"})

      assert(! await bamm.canLiquidate(cUSDC.address, cBTCAddress, dec(1,6)), "expected can liquidate to return false")

      console.log("liquidate")
      const usdcBalBefore = await usdt.balanceOf(fish)
      console.log("ust balance before", (await usdc.balanceOf(fish)).toString())
      await usdt.approve(cUSDC.address, dec(1,6), {from: fish, block: "latest"})      
      console.log((await cUSDT.liquidateBorrow.call(whale, dec(1,6), cETHAddress, {from: fish, block: "latest"})).toString())
      await cUSDT.liquidateBorrow(whale, dec(1,6), cETHAddress, {from: fish, block: "latest"})
      const usdtBalAfter = await usdt.balanceOf(fish)      
      console.log("ust balance after", (await usdt.balanceOf(fish)).toString())

      assert.equal(usdtBalBefore.sub(usdtBalAfter).toString(), dec(1,6), "unexpect ust bal diff")
    })
  })
})


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