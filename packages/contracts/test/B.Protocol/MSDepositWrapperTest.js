const { assert, artifacts } = require("hardhat")
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
const BAMM = artifacts.require("FuseBAMM.sol")
const Admin = artifacts.require("Admin")
const MockWithAdmin = artifacts.require("MockWithAdmin")
const BLens = artifacts.require("BLens.sol")
const ChainlinkTestnet = artifacts.require("ChainlinkTestnet.sol")
const FlashswapStub = artifacts.require("FlashswapStub.sol")
const FlashswapHonest = artifacts.require("FlashswapHonest.sol")
const FlashswapMalicious = artifacts.require("FlashswapMalicious.sol")
const MSDepositWrapper = artifacts.require("MSDepositWrapper.sol")
const MasterChef = artifacts.require("MockChef.sol")

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
    bammOwner, 
    shmuel, yaron, eitan
  ] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3]
  let contracts

  let priceFeed0
  let priceFeed1
  let priceFeed2

  let lusdToken
  let bamm
  let bammETH
  let lens
  let chainlink

  let gasPriceInWei
  let cLUSD

  let token0
  let token1
  let token2

  let cToken0
  let cToken1
  let cToken2
  let cETH

  let rewardToken
  let depositWrapper
  let masterChef

  const feePool = "0x1000000000000000000000000000000000000001"

  const isWithin99Percent = (onePercent, b)=> {
    return (b.gte(onePercent.mul(toBN(99))) && b.lte(onePercent.mul(toBN(100))))
  }

  //const assertRevert = th.assertRevert

  describe("BAMM", async () => {

    before(async () => {
      gasPriceInWei = await web3.eth.getGasPrice()
    })

    beforeEach(async () => {
      // deploy BAMM
      lusdToken = await MockToken.new(7)
      cLUSD = await MockCToken.new(lusdToken.address, false)
      await cLUSD.setExchangeRate(dec(1,18))

      token0 = await MockToken.new(12)
      token1 = await MockToken.new(13)
      token2 = await MockToken.new(4)

      cToken0 = await MockCToken.new(token0.address, false)
      cToken1 = await MockCToken.new(token1.address, false)
      cToken2 = await MockCToken.new(token2.address, false)

      priceFeed0 = await ChainlinkTestnet.new()
      priceFeed1 = await ChainlinkTestnet.new()
      priceFeed2 = await ChainlinkTestnet.new()

      cETH = await MockCToken.new(ZERO_ADDRESS, true)
      
      bammETH = await BAMM.new(cETH.address, true, 400, feePool, {from: bammOwner})
      await bammETH.addCollateral(cToken0.address, priceFeed0.address, {from: bammOwner})
      await bammETH.addCollateral(cToken1.address, priceFeed1.address, {from: bammOwner})
      await bammETH.addCollateral(cToken2.address, priceFeed2.address, {from: bammOwner})

      rewardToken = await MockToken.new(18)
      masterChef = await MasterChef.new(rewardToken.address, bammETH.address, 15)
      await rewardToken.mintToken(masterChef.address, toBN(dec(1000000,18)))
      depositWrapper = await MSDepositWrapper.new(masterChef.address, 15)
    })

    async function mintCToken(underlying, cToken, user, amount) {
      await underlying.mintToken(alice, amount, {from: alice})
      underlying.approve(cToken.address, amount, {from: alice})

      const balanceBefore = await cToken.balanceOf(alice)      
      await cToken.depositToken(amount, {from: alice})
      const balanceAfter = await cToken.balanceOf(alice)
      
      const delta = toBN(balanceAfter).sub(toBN(balanceBefore))

      await cToken.transfer(user, delta, {from: alice})
    }    
   
    it("deposit and withdraw, happy path", async () => {
      const ethDepositAmountShmuel = toBN(dec(2000, 8))
      const ethDepositAmountYaron = toBN(dec(1000, 8))

      const collateralAmount0 = toBN(dec(3000, 8))
      const collateralAmount1 = toBN(dec(6000, 16))

      // deposit eth
      await depositWrapper.deposit({from: shmuel, value: ethDepositAmountShmuel})
      await depositWrapper.deposit({from: yaron, value: ethDepositAmountYaron})

      const shmuelProxy = await depositWrapper.proxies(shmuel)
      const yaronProxy = await depositWrapper.proxies(yaron)
      
      // read balances
      assert.equal((await bammETH.balanceOf(masterChef.address)).toString(), dec(15,17))
      
      assert.equal((await masterChef.bammTokenBalance(shmuelProxy)).toString(), dec(1,18))
      assert.equal((await masterChef.bammTokenBalance(yaronProxy)).toString(), dec(5,17))
      
      // shmuel deposit again
      await depositWrapper.deposit({from: shmuel, value: ethDepositAmountShmuel})
      // read balances
      assert.equal((await masterChef.bammTokenBalance(shmuelProxy)).toString(), dec(2,18))      

      // mimic liquidations
      await mintCToken(token0, cToken0, bammETH.address, collateralAmount0)
      await mintCToken(token1, cToken1, bammETH.address, collateralAmount1)

      // shmuel withdraw half
      // verify no reward before withdrawing
      assert.equal((await rewardToken.balanceOf(shmuel)).toString(), "0")
      assert.equal((await cToken0.balanceOf(shmuel)).toString(), "0")
      assert.equal((await cToken1.balanceOf(shmuel)).toString(), "0")

      await depositWrapper.withdraw(dec(1,18), {from: shmuel})
      assert.equal((await masterChef.bammTokenBalance(shmuelProxy)).toString(), dec(1,18))
      assert.equal((await masterChef.bammTokenBalance(yaronProxy)).toString(), dec(5,17))
      assert.equal((await cToken0.balanceOf(shmuel)).toString(), dec(1200, 8)) // 1/2.5 * 3k
      assert.equal((await cToken1.balanceOf(shmuel)).toString(), dec(2400, 16)) // 1 / 2.5 * 6k
    })
  })
})

// TODO - test:
// 1. ETH debt liquidation. V
// 2. flash callback V
// 3. reentry test V
// 4. efficient withdraw V

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
