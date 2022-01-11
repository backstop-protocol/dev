const { artifacts } = require("hardhat")
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
const ChainlinkTestnet = artifacts.require("ChainlinkTestnet.sol")
const Arb = artifacts.require("Arb.sol")


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

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3]
  let contracts
  let priceFeed
  let lusdToken
  let bamm
  let lens
  let chainlink

  let gasPriceInWei

  let cETH
  let cLUSD

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
    })

    it.only("Arb", async () => {
      const whale = "0x23cBF6d1b738423365c6930F075Ed6feEF7d14f3" // has eth and usdt
/*
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [whale], 
      })

     const cusdc = await MockToken.at("0x04068DA6C83AFCFA0e13ba15A6696662335D5B75")
      const creamArb = await artifacts.require("CreamArb").new()
      console.log("cream", creamArb.address)

      //const isProf = await creamArb.checkProfitableArb.call(dec(1,17), 0, "0x6d62d6Af9b82CDfA3A7d16601DDbCF8970634d22", cusdc.address)
      //console.log({isProf})
       

      console.log("sending usdc")
      //await cusdc.transfer(creamArb.address, dec(3,6), {from: whale})
*/
      const keeper = await artifacts.require("BFantomKeeper").at("0xb5CDc43cefd1826A669Dbd3A8D6180a3B623aef7")//(creamArb.address, {from: whale})

      const bammUsdc = "0xEDC7905a491fF335685e2F2F1552541705138A3D"
      const bammDai = "0x6d62d6Af9b82CDfA3A7d16601DDbCF8970634d22"
/*
      console.log("setting min")
      await keeper.setMinQty(dec(1,16), {from: whale})
      console.log("setting max")
      await keeper.setMaxQty(dec(100000,18), {from: whale})      
      console.log("adding bamm usdc")
      await keeper.addBamm(bammUsdc, {from: whale})
      console.log("adding bamm dai")      
      await keeper.addBamm(bammDai, {from: whale})
*/
      console.log("find qty")
      console.log(keeper.address)
      const result = await keeper.findSmallestQty.call({gas: 100000000})
      console.log(result[0].toString())
      console.log({result})

      console.log("check upkeep")
      const up = await keeper.checkUpkeep.call("0x", {gas: 100000000})
      console.log({up})
      console.log("do upkeep")
      console.log("before", (await cusdc.balanceOf(keeper.address)).toString())
      await keeper.performUpkeep(up.performData)
      console.log("after", (await cusdc.balanceOf(keeper.address)).toString())      

      const res = await keeper.checker.call({gas: 100000000})
      console.log({res})

      const bamm = "0xEDC7905a491fF335685e2F2F1552541705138A3D"
      const dest = "0x29b0Da86e484E1C0029B56e817912d778aC0EC69"
      const creamUSDC = "0x328A7b4d538A2b3942653a9983fdA3C12c571141"

      /*
      console.log("whale", (await cusdc.balanceOf(whale)).toString())      
      await creamArb.arb(bamm, creamUSDC, dec(1,5), dest, {from: whale})

      console.log((await cusdc.balanceOf(creamArb.address)).toString())
      console.log("whale", (await cusdc.balanceOf(whale)).toString())      
      //const tx = await creamArb.f()
     */
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