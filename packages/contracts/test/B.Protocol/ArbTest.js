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

    it("Arb", async () => {
      const whale = "0x23cBF6d1b738423365c6930F075Ed6feEF7d14f3" // has eth and usdt

      const arbAddress = "0xcEAF62Ba209e2FB7990D29c5f5157377D54FC7b2"
      const keeperAddress = "0x102887d6bFC58B0abE721AAD1ce5A036ACe542c8"
/*
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [whale], 
      })*/

      const factory = await (artifacts.require("UniswapFactory.sol")).at("0x1F98431c8aD98523631AE4a59f267346ea31F984")      
      console.log(await factory.getPool.call("0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", 500))
            

      const reserve = await (artifacts.require("UniswapReserve.sol")).at("0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443")


      console.log(await reserve.token0())
      console.log(await reserve.token1())

      const arb = await Arb.at(arbAddress)
      bamm = await BAMM.at("0x24099000AE45558Ce4D049ad46DDaaf71429b168")

      console.log("giving allowance")
      //await arb.approve(bamm.address, {from: whale})

      


      //const arbChecker = await (artifacts.require("ArbChecker.sol")).new(arb.address,{from:whale})

      const bKeeperImpl = await (artifacts.require("BKeeper.sol")).at(keeperAddress)
      //const proxy = await (artifacts.require("KeeperProxy.sol")).new(bKeeperImpl.address, {from:whale})
      //const gelato = await (artifacts.require("BGelato.sol")).new(proxy.address, {from:whale})
      const bKeeper = bKeeperImpl //await (artifacts.require("BKeeper.sol")).at(proxy.address)

      

      //await bKeeper.initParams(dec(1,18), "0", 100, {from: whale})

      //await bKeeper.setMinEthQty(1, {from: whale})
      //await bKeeper.setMaxEthQty(dec(1,18), {from: whale})            
      //await bKeeper.addBamm(bamm.address, {from: whale})      
      console.log("checker()")
      const retVal = await bKeeper.checker.call(/*{gas:100000000}*/)
      console.log(retVal[0].toString())
      console.log(retVal[1].toString())
      console.log((await web3.eth.getBalance(bKeeper.address)).toString())
      await web3.eth.sendTransaction({from: whale, to: bKeeper.address, data: retVal[1]})       
      //await gelato.doer(retVal[1], {from: whale})
      console.log((await web3.eth.getBalance(bKeeper.address)).toString())            
      return


      console.log((await web3.eth.getBalance(arbChecker.address)).toString())      
      await arbChecker.checkProfitableArb("228664402009608",1, bamm.address)
      console.log((await web3.eth.getBalance(arbChecker.address)).toString())

      return
      
      


      console.log("checking bamm price")
      console.log((await bamm.getSwapEthAmount(dec(1,6))).toString())

      console.log(arb.address)
      console.log(await arb.LENS())      
      console.log((await arb.getPrice.call(dec(1,18))).toString())

      console.log("do arbtirage")
      console.log("trying to arb")
      console.log((await web3.eth.getBalance(arb.address)).toString())
      await arb.swap("228664402009608", bamm.address)
      console.log((await web3.eth.getBalance(arb.address)).toString())
    })


    // tests:
    // 1. complex lqty staking + share V
    // 2. share test with ether V
    // 3. basic share with liquidation (withdraw after liquidation) V
    // 4. price that exceeds max discount V
    // 5. price that exceeds balance V
    // 5.5 test fees and return V
    // 5.6 test swap  v
    // 6.1 test fetch price V
    // 6. set params V
    // 7. test with front end v
    // 8. formula V
    // 9. lp token - transfer sad test
    // 11. pickle V
    // 10. cleanups - compilation warnings. cropjoin - revoke changes and maybe make internal. V
    // 12 - linter. events
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