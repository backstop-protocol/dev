const deploymentHelper = require("./../../utils/deploymentHelpers.js")
const testHelpers = require("./../../utils/testHelpers.js")
const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN

const MockToken = artifacts.require("ERC20Mock.sol")
const GemSeller = artifacts.require("GemSeller.sol")
const BAMM = artifacts.require("BAMM.sol")
const ChainlinkTestnet = artifacts.require("ChainlinkTestnet.sol")

const ZERO_ADDRESS = th.ZERO_ADDRESS


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

  let lusd
  let lqty
  let bamm
  let eth2UsdPriceFeed
  let lqty2EthPriceFeed
  let lusd2UsdPriceFeed
  let seller
  const virtualLusdImbalance = dec(1e6, 18)
  let sellerOwner

  const feePool = "0x1000000000000000000000000000000000000001"


  const openTrove = async (params) => th.openTrove(contracts, params)
  //const assertRevert = th.assertRevert

  describe("GemSeller", async () => {

    before(async () => {
      gasPriceInWei = await web3.eth.getGasPrice()
    })

    beforeEach(async () => {

      eth2UsdPriceFeed = await ChainlinkTestnet.new(ZERO_ADDRESS)
      lqty2EthPriceFeed = await ChainlinkTestnet.new(ZERO_ADDRESS)
      lusd2UsdPriceFeed = await ChainlinkTestnet.new(ZERO_ADDRESS)

      await eth2UsdPriceFeed.setPrice(dec(1200, 18))
      await lqty2EthPriceFeed.setPrice(dec(87731, 10)) // 0.00087731
      await lusd2UsdPriceFeed.setPrice(dec(101, 16)) // 1.01

      lqty2LusdPrice = dec(104234851, 10) // 1.04234851

      
      lusd = await MockToken.new("LUSD", "LUSD", whale, dec(10, 18 + 6))
      lqty = await MockToken.new("LQTY", "LQTY", whale, dec(10, 18 + 6))
      
      sellerOwner = alice

      const bammContract = await BAMM.new(eth2UsdPriceFeed.address,
                                          lusd2UsdPriceFeed.address,
                                          sellerOwner,
                                          lusd.address,
                                          lqty.address,
                                          400,
                                          feePool,
                                          sellerOwner,
                                          sellerOwner,
                                          {from: sellerOwner})
      bamm = bammContract.address

      seller = await GemSeller.new(lqty2EthPriceFeed.address,
                                    eth2UsdPriceFeed.address,
                                    lusd2UsdPriceFeed.address,
                                    lusd.address,
                                    lqty.address,
                                    bamm,
                                    virtualLusdImbalance,
                                    400,
                                    feePool, {from: sellerOwner})
      
      await bammContract.setSeller(seller.address, {from: sellerOwner})
    })

    it('test set params sad path', async () => {
      await assertRevert(seller.setParams(210, 100, {from: sellerOwner}), 'setParams: A too big')
      await assertRevert(seller.setParams(9, 100, {from: sellerOwner}), 'setParams: A too small')
      await assertRevert(seller.setParams(10, 101, {from: sellerOwner}), 'setParams: fee is too big')             
      await assertRevert(seller.setParams(20, 100, {from: B}), 'Ownable: caller is not the owner')      
    })

    it('test price fetchers', async () => {
      assert.equal(web3.utils.fromWei(await seller.fetchGem2EthPrice()), "0.00087731")
      assert.equal(web3.utils.fromWei(await seller.fetchEthPrice()), "1200")

      assert.equal((await seller.gemToLUSD(dec(1, 18), dec(7,18), dec(1200, 18))).toString(),
                   dec(7 * 1200, 18))

      assert.equal((await seller.LUSDToGem(dec(7 * 1200, 18), dec(7,18), dec(1200, 18))).toString(),
                   dec(1, 18))
    })

    it('test price fetchers', async () => {
      assert.equal(web3.utils.fromWei(await seller.fetchGem2EthPrice()), "0.00087731")
      assert.equal(web3.utils.fromWei(await seller.fetchEthPrice()), "1200")

      assert.equal((await seller.gemToLUSD(dec(1, 18), dec(7,18), dec(1200, 18))).toString(),
                   dec(7 * 1200, 18))

      assert.equal((await seller.LUSDToGem(dec(7 * 1200, 18), dec(7,18), dec(1200, 18))).toString(),
                   dec(1, 18))
    })    

    it('test compensateForLusdDeviation', async () => {
      assert.equal((await seller.compensateForLusdDeviation(dec(1,18))).toString(),
                   dec(101, 16))
    })

    it('test getSwapGemAmount', async () => {
      const lusdBalance = virtualLusdImbalance
      const lqtyBalance = dec(10000, 18)
      const lqtyInUSD = dec(100 * 10000 * 0.00087731 * 1200, 16)
      const lusdQty = dec(1000, 18)

      // send 10k lqty to bamm
      await lqty.transfer(bamm, lqtyBalance, {from: whale})

      // set fees to 0.5%
      await seller.setParams(100, 50,{from: sellerOwner})

      // check price for 1k lusd
      const result = await seller.getSwapGemAmount(lusdQty)

      // check fees
      assert.equal(result.feeLusdAmount, dec(5, 18))

      // calc amount
      const expectedReturnInUSD = await seller.getReturn(lusdQty, lusdBalance, toBN(lusdBalance).add(toBN(lqtyInUSD).mul(toBN("2"))), 100)
      const expectedReturnInLqty = expectedReturnInUSD.mul(toBN(lqtyBalance)).div(toBN(lqtyInUSD))

      // multiply amount by 1.01 to compensate for lusd/usdc deviation
      const adjustedExpectedReturn = toBN(expectedReturnInLqty).mul(toBN("101")).div(toBN("100"))
      assert.equal(result.gemAmount.toString(), adjustedExpectedReturn.toString())
    })

    it('test swap', async () => {
      const lqtyBalance = dec(10000, 18)
      const lusdQty = dec(1000, 18)

      // send lusd to alice
      await lusd.transfer(alice, lusdQty, {from: whale})
      
      // give allowance to seller
      await lusd.approve(seller.address, lusdQty, {from: alice})

      // send 10k lqty to bamm
      await lqty.transfer(bamm, lqtyBalance, {from: whale})

      // set fees to 0.5%
      await seller.setParams(100, 50,{from: sellerOwner})

      // check price for 1k lusd
      const result = await seller.getSwapGemAmount(lusdQty)

      // do the swap
      await seller.swap(lusdQty, 1, carol, {from: alice})

      // check fees went to pool
      assert.equal((await lusd.balanceOf(feePool)).toString(), result.feeLusdAmount.toString())

      // check lqty went to carol
      assert.equal((await lqty.balanceOf(carol)).toString(), result.gemAmount.toString())

      // check bamm lusd balance increased
      assert.equal((await lusd.balanceOf(bamm)).toString(), toBN(lusdQty).sub(toBN(result.feeLusdAmount)).toString())
      
      // check bamm lqty balance decreased as expected
      assert.equal((await lqty.balanceOf(bamm)).toString(), toBN(lqtyBalance).sub(result.gemAmount).toString())      
    })   
    

  })
})




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