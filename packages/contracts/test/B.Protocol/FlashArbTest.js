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
const Keeper = artifacts.require("FlashKeeper.sol")


const ZERO = toBN('0')
const ZERO_ADDRESS = th.ZERO_ADDRESS
const maxBytes32 = th.maxBytes32

const getFrontEndTag = async (stabilityPool, depositor) => {
  return (await stabilityPool.deposits(depositor))[1]
}

const bammUSDT = "0x1EcF1b0DE9b4c2D01554062eA2faB84b1917B41d"
const bammDAI = "0x998Bf304Ce9Cb215F484aA39d1177b8210078f49"
const bammUSDC = "0x0F0dD66D2d6c1f3b140037018958164c6AB80d56"
const bamms = [bammUSDT, bammDAI, bammUSDC]


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
      
      console.log("deploying keeper")
      const keeper = await Keeper.new()
      console.log(keeper.address)

      console.log("adding bamms")
      for(const bamm of bamms) {
        await keeper.addBamm(bamm)
        console.log("bamm was added")
      }

      //const keeper = await Keeper.at("0x7a0187613355902C009acBF1ed74031Ad9ff4A96")

      console.log("trying to find smallest qty")
      const res = await keeper.findSmallestQty.call({gas: 100000000})
      console.log({res})
      
      console.log("calling upkeep")
      const resUp = await keeper.checkUpkeep.call("0x")
      console.log({resUp})
      console.log("calling perform")
      await keeper.performUpkeep(resUp.performData)
      console.log("done")

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