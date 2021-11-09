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

  const fvat = "0x1001009911e3FE1d5B45FF8Efea7732C33a6C012"
  const whale = "0xE67Faab7a523C467E214C170abBfFbA8FDF57afc" // has eth and usdt
  const fish = "0x23cBF6d1b738423365c6930F075Ed6feEF7d14f3" // has cETH and usdt debt

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3]
  let contracts
  let priceFeed
  let lusdToken
  let bamm
  let lens
  let chainlink
  let usdt
  let cETH
  let cUSDT
  let fakePrice

  let gasPriceInWei

  const cETHAddress = "0xfCD8570AD81e6c77b8D252bEbEBA62ed980BD64D"
  const cUSDTAddress = "0xE4e43864ea18d5E5211352a4B810383460aB7fcC"
  const USDTAddress = "0x049d68029688eAbF473097a2fC38ef61633A3C7A"
  const chainlinkAddress = "0xf4766552D15AE4d256Ad41B6cf2933482B0680dc"

  const feePool = "0x1000000000000000000000000000000000000001"

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

      usdt = await MockToken.at(USDTAddress)
      cETH = await CETH.at(cETHAddress)
      cUSDT = await CErc20Interface.at(cUSDTAddress)      

      console.log("send eth to fish")
      await web3.eth.sendTransaction({from: whale, to: fish, value: toBN(dec(1, 18))})

      console.log("send ust to fish")
      await usdt.transfer(fish, dec(1000,6), {from: whale, block: "latest"})
    })

    beforeEach(async () => {

    })

    it("liquidate with b.protocol happy path", async () => {
      const unicomptroller = await Comptroller.at("0x0F390559F258eB8591C8e31Cf0905E97cf36ACE2")
      const unitroller = await Unitroller.at("0x0F390559F258eB8591C8e31Cf0905E97cf36ACE2")

      console.log("enter market")
      await unicomptroller.enterMarkets([cETH.address], {from: whale, block: "latest"})
      console.log("deposit cETH")
      await cETH.mint({from: whale, value: dec(6,18), block: "latest"})
      console.log("whale balance:", (await usdt.balanceOf(whale)).toString())
      await cUSDT.borrow(dec(5,6), {from: whale, block: "latest"})
      console.log("whale balance:", (await usdt.balanceOf(whale)).toString())            

      console.log("deploying fake price")
      fakePrice = await FakePrice.new(cETHAddress, "0x10010069DE6bD5408A6dEd075Cf6ae2498073c73", {from: fvat})

      console.log("setting new price oracle")
      await unicomptroller._setPriceOracle(fakePrice.address, {from: fvat, block: "latest"})

      console.log("setting new eth price")
      await fakePrice.setCETHPrice(dec(1, 18), {from: fvat})

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

      console.log("deploying bamm")
      bamm = await BAMM.new(chainlinkAddress,
                            USDTAddress,
                            cETHAddress,
                            cUSDTAddress,
                            400,
                            feePool,
                            {from: fvat, block: "latest"})
      console.log("bamm address", bamm.address)

      console.log("set b.protocol")
      await unicomptroller._setBProtocol(bamm.address, {from: fvat, block: "latest"})
      console.log("set b.protocol - done")

      console.log("give allowance to bamm")
      await usdt.approve(bamm.address, dec(1000, 6), {from: whale, block: "latest"})

      console.log("whale balance:", (await usdt.balanceOf(whale)).toString())

      console.log("deposit usdt to bamm")
      await bamm.deposit(dec(1000, 6), {from: whale, block: "latest"})
      console.log("deposit done")

      console.log("liquidate")
      const ethBalBefore = toBN(await web3.eth.getBalance(bamm.address))
      const usdtBalBefore = await usdt.balanceOf(bamm.address)

      console.log("eth balance before", (await web3.eth.getBalance(bamm.address)).toString())
      console.log("ust balance before", (await usdt.balanceOf(bamm.address)).toString())

      await assertRevert(cUSDT.liquidateBorrow(whale, dec(1,6), cETHAddress, {from: fish, block: "latest"}), 'only B.Protocol can liquidate')

      await bamm.liquidateBorrow(whale, dec(1,6), cETHAddress, {from: whale, block: "latest"})

      console.log("eth balance after", (await web3.eth.getBalance(bamm.address)).toString())
      console.log("ust balance before", (await usdt.balanceOf(bamm.address)).toString())

      const ethBalAfter = toBN(await web3.eth.getBalance(bamm.address))
      const usdtBalAfter = await usdt.balanceOf(bamm.address)

      assert.equal(usdtBalBefore.sub(usdtBalAfter).toString(), dec(1,6), "unexpect ust bal diff")
      assert(toBN(ethBalAfter.sub(ethBalBefore)).gt(toBN(dec(108, 18 -2))))
    })

    it("try to set bprotocol from non owner", async () => {
      const unicomptroller = await Comptroller.at("0x0F390559F258eB8591C8e31Cf0905E97cf36ACE2")
      await assertRevert(unicomptroller._setBProtocol(bamm.address, {from: fish}), "only admin can set B.Protocol")
    })

    it("liquidate without b.protocol - b.protocol not set", async () => {
      const unicomptroller = await Comptroller.at("0x0F390559F258eB8591C8e31Cf0905E97cf36ACE2")
      const unitroller = await Unitroller.at("0x0F390559F258eB8591C8e31Cf0905E97cf36ACE2")

      console.log("set b.protocol")
      await unicomptroller._setBProtocol("0x0000000000000000000000000000000000000000", {from: fvat, block: "latest"})
      console.log("set b.protocol - done")

      console.log("whale balance:", (await usdt.balanceOf(whale)).toString())

      console.log("liquidate")
      const usdtBalBefore = await usdt.balanceOf(fish)
      console.log("ust balance before", (await usdt.balanceOf(fish)).toString())
      await usdt.approve(cUSDT.address, dec(1,6), {from: fish, block: "latest"})      
      console.log((await cUSDT.liquidateBorrow.call(whale, dec(1,6), cETHAddress, {from: fish, block: "latest"})).toString())
      await cUSDT.liquidateBorrow(whale, dec(1,6), cETHAddress, {from: fish, block: "latest"})
      const usdtBalAfter = await usdt.balanceOf(fish)      
      console.log("ust balance after", (await usdt.balanceOf(fish)).toString())

      assert.equal(usdtBalBefore.sub(usdtBalAfter).toString(), dec(1,6), "unexpect ust bal diff")
    })

    it("liquidate without b.protocol - b.protocol can liquidate return false", async () => {
      const unicomptroller = await Comptroller.at("0x0F390559F258eB8591C8e31Cf0905E97cf36ACE2")
      const unitroller = await Unitroller.at("0x0F390559F258eB8591C8e31Cf0905E97cf36ACE2")

      console.log("set b.protocol")
      await unicomptroller._setBProtocol(bamm.address, {from: fvat, block: "latest"})
      assert.equal(await unicomptroller.bprotocol(), bamm.address, "unexpected b.protocol address")
      console.log("set b.protocol - done")

      console.log("withdraw all bamm balance")
      await bamm.withdraw(await bamm.balanceOf(whale), {from: whale, block: "latest"})

      assert(! await bamm.canLiquidate(cUSDT.address, cETHAddress, dec(1,6)), "expected can liquidate to return false")

      console.log("liquidate")
      const usdtBalBefore = await usdt.balanceOf(fish)
      console.log("ust balance before", (await usdt.balanceOf(fish)).toString())
      await usdt.approve(cUSDT.address, dec(1,6), {from: fish, block: "latest"})      
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