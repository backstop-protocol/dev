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
const Arb = artifacts.require("FlashArb.sol")



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


    it("Arb iotex", async () => {
      const router = "0x95cB18889B968AbABb9104f30aF5b310bD007Fd8"
      const wmatic = "0xA00744882684C3e4747faEFD68D283eA44099D03"
      const hmatic = "0x243E33aa7f6787154a8E59d3C27a66db3F8818ee"

      const iotexBamms = ["0xCE0A876996248421606F4ad8a09B1D3E15f69EfB","0x4Db1d29eA5b51dDADcc5Ab26709dDA49e7eB1E71", "0x8cF0B1c886Ee522427ef57F5601689352F8161eb", "0x7D30d048F8693aF30A10aa5D6d281A7A7E6E1245"]
      const keepers = []

      for(const bamm of iotexBamms) {
        console.log("deploying keepers")
        const keeper = await Keeper.new(router, wmatic, hmatic, true)
        console.log(keeper.address)
        keepers.push(keeper)

        console.log("adding 1 bamm")
        await keeper.addBamm(bamm)

        console.log("setting min profit to 100000000")
        await keeper.setMinProfitInUSD("1000000000000000")

        console.log("set max attempts to 3")
        await keeper.setMaxQtyAttempts(3)

        console.log("trying to find smallest qty")
        const res = await keeper.findSmallestQty.call({gas: 100000000})
        console.log({res})        
      }

      console.log({keepers})
/*      
      console.log("calling upkeep")
      const resUp = await keeper.checkUpkeep.call("0x",{gas: 100000000})
      console.log({resUp})
      console.log("calling perform")
      await keeper.performUpkeep(resUp.performData)
      console.log("done")
*/

    })  

    it.only("Arb fantom", async () => {
      const router = "0xF491e7B69E4244ad4002BC14e878a34207E38c29"
      const wFTM = "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83"
      const hFTM = "0xfCD8570AD81e6c77b8D252bEbEBA62ed980BD64D"

      const iotexBamms = ["0xD3f08B1c4861dacC3ce539B9F4748AA25dCb72aE","0x3A87b540F7EaeC7b20902039818B5Ea78F984305", "0x1346e106b4E2558DAACd2E8207505ce7E31e05CA", "0x01ba129F27df71ADfeDdf2447eFD8698B718D593"]
      const keepers = []

      for(const bamm of iotexBamms) {
        console.log("deploying keepers")
        const keeper = await Keeper.new(router, wFTM, hFTM, false)
        console.log(keeper.address)
        keepers.push(keeper)

        console.log("adding 1 bamm")
        await keeper.addBamm(bamm)

        console.log("setting min profit to 100000000")
        await keeper.setMinProfitInUSD("1000000000000000")

        console.log("set max attempts to 3")
        await keeper.setMaxQtyAttempts(2)

        console.log("trying to find smallest qty")
        const res = await keeper.findSmallestQty.call({gas: 100000000})
        console.log({res})        
      }

      console.log({keepers})
/*      
      console.log("calling upkeep")
      const resUp = await keeper.checkUpkeep.call("0x",{gas: 100000000})
      console.log({resUp})
      console.log("calling perform")
      await keeper.performUpkeep(resUp.performData)
      console.log("done")
*/

    })    

    it("Arb", async () => {
      
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