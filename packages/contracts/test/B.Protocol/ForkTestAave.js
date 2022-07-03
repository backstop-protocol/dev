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
  const yaron = "0xDdA7F2654D85653C92513B58305348Da627C7cf0"
  const feePool = yaron

  let aaveToCToken
  let bamm
  let aToken

  describe("aave", async () => {

    before(async () => {
      //await hre.network.provider.request({method: "hardhat_impersonateAccount",params: [yaron],})      
      aaveToCToken = await AaveToCToken.new(aWMATIC, lendingPoolAddressesProvider, {from: yaron,maxFeePerGas: 99e9, maxPriorityFeePerGas: 99e9})
      console.log("aave to c", aaveToCToken.address)

      bamm = await BAMM.new(aaveToCToken.address,
                            false,
                            400,
                            feePool,
                            {from: yaron,maxFeePerGas: 99e9, maxPriorityFeePerGas: 99e9})

      console.log("bamm address", bamm.address)

      await aaveToCToken.setBAMM(bamm.address, {from: yaron,maxFeePerGas: 99e9, maxPriorityFeePerGas: 99e9})

      aToken = await MockToken.at(aWMATIC)      
    })

    beforeEach(async () => {

    })

    it("deposit aWMATIC", async () => {
      const balance = toBN(await aToken.balanceOf(yaron)).div(toBN(2))
      console.log("balance", balance.toString())
      console.log("giving allowance")
      await aToken.approve(aaveToCToken.address, balance, {from: yaron,maxFeePerGas: 99e9, maxPriorityFeePerGas: 99e9})

      console.log("depositing")
      await bamm.deposit(balance, {from: yaron,maxFeePerGas: 99e9, maxPriorityFeePerGas: 99e9})

      console.log("withdrawing")
      await bamm.withdraw(toBN(balance).div(toBN(2)), {from: yaron,maxFeePerGas: 99e9, maxPriorityFeePerGas: 99e9})
    })

    it("setup aDAI as collateral", async () => {
      const cDAI = await AaveToCToken.new(aDAI, lendingPoolAddressesProvider, {from: yaron,maxFeePerGas: 99e9, maxPriorityFeePerGas: 99e9})
      const balance = toBN(await cDAI.balanceOf(yaron)).div(toBN(2))
      console.log("give allowance to cDAI")
      const aDAIToken = await MockToken.at(aDAI)
      await aDAIToken.approve(cDAI.address, balance, {from: yaron,maxFeePerGas: 99e9, maxPriorityFeePerGas: 99e9})
      console.log("transfer to bamm")
      await cDAI.transfer(bamm.address, balance, {from: yaron,maxFeePerGas: 99e9, maxPriorityFeePerGas: 99e9})

      // setup a price feed
      console.log("setup price feed")
      const priceFeed = await FakeChainlink.new({from: yaron,maxFeePerGas: 99e9, maxPriorityFeePerGas: 99e9})
      console.log("set price to 2")
      await priceFeed.setPrice(dec(2,18),{from: yaron,maxFeePerGas: 99e9, maxPriorityFeePerGas: 99e9})

      console.log("add collateral")
      await bamm.addCollateral(cDAI.address, priceFeed.address, {from: yaron,maxFeePerGas: 99e9, maxPriorityFeePerGas: 99e9})

      console.log("swap matic to dai")
      const maticBalance = await aToken.balanceOf(yaron)
      console.log("giving allowance")
      await aToken.approve(aaveToCToken.address, maticBalance, {from: yaron,maxFeePerGas: 99e9, maxPriorityFeePerGas: 99e9})

      // swap
      console.log("swap")
      await bamm.swap(maticBalance, cDAI.address, 1, yaron, "0x", {from: yaron,maxFeePerGas: 99e9, maxPriorityFeePerGas: 99e9})

      console.log("alice balance", (await cDAI.balanceOf(yaron)).toString())
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