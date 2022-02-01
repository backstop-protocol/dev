const { assert } = require("hardhat")
const deploymentHelper = require("./../../utils/deploymentHelpers.js")
const testHelpers = require("./../../utils/testHelpers.js")
const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const TroveManagerTester = artifacts.require("TroveManagerTester")
const LUSDToken = artifacts.require("LUSDToken")
const NonPayable = artifacts.require('NonPayable.sol')
const BAMM = artifacts.require("BAMM.sol")
const BLens = artifacts.require("BLens.sol")
const ChainlinkTestnet = artifacts.require("ChainlinkTestnet.sol")
const KeeperRebate = artifacts.require("KeeperRebate.sol")

const ZERO = toBN('0')
const ZERO_ADDRESS = th.ZERO_ADDRESS
const maxBytes32 = th.maxBytes32

const getFrontEndTag = async (stabilityPool, depositor) => {
  return (await stabilityPool.deposits(depositor))[1]
}

contract('BAMM', async accounts => {
  const [owner,
    defaulter_1, defaulter_2, defaulter_3,
    whale,
    alice, bob, carol, dennis, erin, flyn,
    A, B, C, D, E, F,
    u1, u2, u3, u4, u5,
    v1, v2, v3, v4, v5,
    frontEnd_1, frontEnd_2, frontEnd_3,
    bammOwner
  ] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3]
  let contracts
  let priceFeed
  let lusdToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let bamm
  let lens
  let chainlink
  let lusdChainlink
  let defaultPool
  let borrowerOperations
  let lqtyToken
  let communityIssuance
  let realBamm

  let keeperRebate
  let feePoolContract

  let gasPriceInWei

  const feePool = "0x7095F0B91A1010c11820B4E263927835A4CF52c9"
  const feePoolOwner = "0xF15aBf59A957aeA1D81fc77F2634a2F55dD3b280"

  const deployer = "0x23cBF6d1b738423365c6930F075Ed6feEF7d14f3"
  const bammAddress = "0x00FF66AB8699AAfa050EE5EF5041D1503aa0849a"

  // whale of both eth and lusd
  const optimisimBridge = "0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1"

  const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"


  const getOpenTroveLUSDAmount = async (totalDebt) => th.getOpenTroveLUSDAmount(contracts, totalDebt)
  const openTrove = async (params) => th.openTrove(contracts, params)
  //const assertRevert = th.assertRevert

  describe("Keeper", async () => {

    before(async () => {
      gasPriceInWei = await web3.eth.getGasPrice()
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [deployer], 
      })
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [optimisimBridge], 
      })
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [feePoolOwner], 
      })      

      

      lusdToken = await LUSDToken.at("0x5f98805A4E8be255a32880FDeC7F6728C6568bA0")

      // send some eth to feepool owner
      await web3.eth.sendTransaction({from: optimisimBridge, to: feePoolOwner, value: toBN(dec(3, 18))})

      // send some eth to deployer
      await web3.eth.sendTransaction({from: optimisimBridge, to: deployer, value: toBN(dec(3, 18))})

      // send some eth to bamm
      await web3.eth.sendTransaction({from: optimisimBridge, to: bammAddress, value: toBN(dec(3, 18))})

      // send some lusd to bamm
      await lusdToken.transfer(bammAddress, dec(10000, 18), {from: optimisimBridge})

      // send some lusd and eth to alice and bob
      await web3.eth.sendTransaction({from: optimisimBridge, to: alice, value: toBN(dec(3, 18))})
      await web3.eth.sendTransaction({from: optimisimBridge, to: bob, value: toBN(dec(3, 18))})      
      await lusdToken.transfer(alice, dec(10000, 18), {from: optimisimBridge})

      console.log("deploying rebate")
      keeperRebate = await KeeperRebate.new(bammAddress, {from: deployer})

      console.log("setting bob as lister")
      await keeperRebate.setKeeperLister(bob, {from: deployer})

      console.log("setting alice as keeper")
      await keeperRebate.listKeeper(alice, true, {from: bob})

      console.log("Transfer fee pool ownership to rebate keeper")
      feePoolContract = await BAMM.at(feePool)
      await feePoolContract.transferOwnership(keeperRebate.address, {from:feePoolOwner})

      realBamm = await BAMM.at(bammAddress)

      console.log("set fees to bamm")
      await realBamm.setParams(20, 100, {from: deployer})

    })

    beforeEach(async () => {

    })

    // --- provideToSP() ---
    // increases recorded LUSD at Stability Pool
    it("test get price", async () => {
      const realRetVal = await realBamm.getSwapEthAmount(dec(1,18))
      const expectedVal = await keeperRebate.getReturnedSwapAmount(lusdToken.address, dec(1,18), ETH)

      assert.equal(realRetVal[0].toString(), expectedVal.outAmount.toString())
      assert.equal(realRetVal[1].toString(), expectedVal.rebateAmount.toString())
      assert.equal(expectedVal.rebateToken.toString(), lusdToken.address.toString())
      console.log("done")
    })

    it("test get token", async () => {
      const outTokens = await keeperRebate.getTokens()

      assert.equal(outTokens.length, 1)
      assert.equal(outTokens[0].outTokens.length, 1)
      assert.equal(outTokens[0].rebateTokens.length, 1)      

      assert.equal(outTokens[0].outTokens[0], ETH)
      assert.equal(outTokens[0].rebateTokens[0], lusdToken.address)

      assert.equal(outTokens[0].inToken, lusdToken.address)
    })    

    it("test swap", async () => {
      console.log("check epected value")
      const expectedVal = await keeperRebate.getReturnedSwapAmount(lusdToken.address, dec(1,18), ETH)
      console.log(expectedVal.outAmount.toString(), expectedVal.rebateAmount.toString())
      assert(expectedVal.rebateAmount.toString() !== "0")

      const maxRebate = toBN(expectedVal.rebateAmount.toString()).div(toBN("2"))
      console.log("max rebate", maxRebate.toString())
      
      console.log("give allowance to rebate")
      await lusdToken.approve(keeperRebate.address, dec(1000000,18), {from: alice})
      console.log("do swap and hope for the best")
      const emptyAddress = "0x5f98805a4e8bE255a32880FDEC7f6728c6568bA1"
      //await keeperRebate.swapWithRebate(dec(1,18), 1, maxRebate, emptyAddress, {from: alice})
      await keeperRebate.swap(lusdToken.address, dec(1,18), ETH, 1, maxRebate, emptyAddress, {from: alice})      

      console.log("check emptyAddress balance")
      const lusdBalance = await lusdToken.balanceOf(emptyAddress)
      console.log("empty lusd balance", lusdBalance.toString())
      const ethBalance = await web3.eth.getBalance(emptyAddress)

      assert.equal(lusdBalance.toString(), maxRebate.toString())
      assert.equal(ethBalance.toString(), expectedVal.outAmount.toString())      
    })

    it("sad paths", async () => {
      console.log("list keeper from non owner")      
      await assertRevert(keeperRebate.listKeeper(carol, true, {from: deployer}), "listKeeper: !lister")

      console.log("set keeper lister from non owner")      
      await assertRevert(keeperRebate.setKeeperLister(carol, {from: alice}), "Ownable: caller is not the owner")

      console.log("transfer fee pool ownership from non owner")      
      await assertRevert(keeperRebate.transferFeePoolOwnership(carol, {from: alice}), "Ownable: caller is not the owner")      

      console.log("swap from non keeper")
      await keeperRebate.listKeeper(alice, false, {from: bob})
      await assertRevert(keeperRebate.swap(lusdToken.address, dec(1,18), ETH, 1, 1, alice, {from: alice}), "swapWithRebate: !keeper")      
    })    

    it("transfer ownership on fee pool", async () => {
      await keeperRebate.transferFeePoolOwnership(carol, {from: deployer})
      const newOwner = await feePoolContract.owner()
      assert.equal(newOwner.toString(), carol.toString())
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