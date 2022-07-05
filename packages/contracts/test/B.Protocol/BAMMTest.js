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
const ChainlinkTestnet = artifacts.require("ChainlinkTestnet.sol")

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

  let gasPriceInWei

  let chicken

  const feePool = "0x1000000000000000000000000000000000000001"
  const lqtySeller = "0x1000000000000000000000000000000000000002"

  const getOpenTroveLUSDAmount = async (totalDebt) => th.getOpenTroveLUSDAmount(contracts, totalDebt)
  const openTrove = async (params) => th.openTrove(contracts, params)
  //const assertRevert = th.assertRevert

  describe("BAMM", async () => {

    before(async () => {
      gasPriceInWei = await web3.eth.getGasPrice()
    })

    beforeEach(async () => {
      contracts = await deploymentHelper.deployLiquityCore()
      contracts.troveManager = await TroveManagerTester.new()
      contracts.lusdToken = await LUSDToken.new(
        contracts.troveManager.address,
        contracts.stabilityPool.address,
        contracts.borrowerOperations.address
      )
      const LQTYContracts = await deploymentHelper.deployLQTYContracts(bountyAddress, lpRewardsAddress, multisig)

      priceFeed = contracts.priceFeedTestnet
      lusdToken = contracts.lusdToken
      sortedTroves = contracts.sortedTroves
      troveManager = contracts.troveManager
      activePool = contracts.activePool
      stabilityPool = contracts.stabilityPool
      defaultPool = contracts.defaultPool
      borrowerOperations = contracts.borrowerOperations
      hintHelpers = contracts.hintHelpers

      lqtyToken = LQTYContracts.lqtyToken
      communityIssuance = LQTYContracts.communityIssuance

      await deploymentHelper.connectLQTYContracts(LQTYContracts)
      await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
      await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)

      // Register 3 front ends
      //await th.registerFrontEnds(frontEnds, stabilityPool)

      // deploy BAMM
      chainlink = await ChainlinkTestnet.new(priceFeed.address)
      lusdChainlink = await ChainlinkTestnet.new(ZERO_ADDRESS)

      const kickbackRate_F1 = toBN(dec(5, 17)) // F1 kicks 50% back to depositor
      await stabilityPool.registerFrontEnd(kickbackRate_F1, { from: frontEnd_1 })

      chicken = defaulter_3

      bamm = await BAMM.new(chainlink.address,
                            lusdChainlink.address,
                            stabilityPool.address,
                            lusdToken.address,
                            lqtyToken.address,
                            400,
                            feePool,
                            frontEnd_1,
                            14 * 24 * 60 * 60,
                            {from: bammOwner})

      await bamm.setSeller(lqtySeller, {from: bammOwner})
      await bamm.setChicken(chicken, {from: bammOwner})

      await lusdChainlink.setPrice(dec(1,18)) // 1 LUSD = 1 USD
    })

    // --- provideToSP() ---
    // increases recorded LUSD at Stability Pool
    it("deposit(): increases the Stability Pool LUSD balance", async () => {
      // --- SETUP --- Give Alice a least 200
      await openTrove({ extraLUSDAmount: toBN(200), ICR: toBN(dec(2, 18)), extraParams: { from: chicken } })

      // --- TEST ---
      await lusdToken.approve(bamm.address, toBN(200), { from: chicken })
      await bamm.deposit(toBN(200), { from: chicken })

      // check LUSD balances after
      const stabilityPool_LUSD_After = await stabilityPool.getTotalLUSDDeposits()
      assert.equal(stabilityPool_LUSD_After, 200)
    })

    // --- provideToSP() ---
    // increases recorded LUSD at Stability Pool
    it("deposit(): user deposit, withdraw.", async () => {
      // --- SETUP --- Give Alice a least 200
      await openTrove({ extraLUSDAmount: toBN(200), ICR: toBN(dec(2, 18)), extraParams: { from: chicken } })

      // --- TEST ---
      await lusdToken.approve(bamm.address, toBN(200), { from: chicken })
      await bamm.deposit(toBN(200), { from: chicken })

      await bamm.withdraw(toBN(150), whale, { from: chicken });
      await bamm.withdraw(toBN(50), alice, { from: chicken });

      assert.equal((await lusdToken.balanceOf(whale)).toString(), toBN(150).toString())
      assert.equal((await lusdToken.balanceOf(alice)).toString(), toBN(50).toString())
    })

    it('rebalance scenario', async () => {
      // --- SETUP ---

      // Whale opens Trove and deposits to SP
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: chicken, value: dec(50, 'ether') } })
      const whaleLUSD = await lusdToken.balanceOf(chicken)
      await lusdToken.approve(bamm.address, whaleLUSD, { from: chicken })
      await bamm.deposit(whaleLUSD, { from: chicken } )

      // 2 Troves opened, each withdraws minimum debt
      await openTrove({ extraLUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1, } })
      await openTrove({ extraLUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2, } })

      // Alice makes Trove and withdraws 100 LUSD
      await openTrove({ extraLUSDAmount: toBN(dec(100, 18)), ICR: toBN(dec(5, 18)), extraParams: { from: alice, value: dec(50, 'ether') } })


      // price drops: defaulter's Troves fall below MCR, whale doesn't
      await priceFeed.setPrice(dec(105, 18));
      console.log("rebalance", (await bamm.fetchPrice()).toString())

      const SPLUSD_Before = await stabilityPool.getTotalLUSDDeposits()

      // Troves are closed
      await troveManager.liquidate(defaulter_1, { from: owner })
      await troveManager.liquidate(defaulter_2, { from: owner })

      // Confirm SP has decreased
      const SPLUSD_After = await stabilityPool.getTotalLUSDDeposits()
      assert.isTrue(SPLUSD_After.lt(SPLUSD_Before))

      console.log((await stabilityPool.getCompoundedLUSDDeposit(bamm.address)).toString())
      console.log((await stabilityPool.getDepositorETHGain(bamm.address)).toString())
      const price = await priceFeed.fetchPrice.call()
      console.log(price.toString())

      const totalValue = await bamm.getLUSDValue()

      const ammExpectedEth = await bamm.getSwapEthAmount.call(toBN(dec(1, 18)))

      console.log("expected eth amount", ammExpectedEth.ethAmount.toString())

      const rate = await bamm.getConversionRate(lusdToken.address, "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", toBN(dec(1, 18)), 0)
      assert.equal(rate.toString(), ammExpectedEth.ethAmount.toString())

      await lusdToken.approve(bamm.address, toBN(dec(1, 18)), { from: alice })

      const dest = "0xe1A587Ac322da1611DF55b11A6bC8c6052D896cE" // dummy address
      //await bamm.swap(toBN(dec(1, 18)), dest, { from: alice })
      await bamm.trade(lusdToken.address, toBN(dec(1, 18)), "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", dest, rate, true, { from: alice });

      const swapBalance = await web3.eth.getBalance(dest)

      assert.equal(swapBalance, ammExpectedEth.ethAmount)
    })

    it('test withdraw with ether', async () => {
      // --- SETUP ---

      // Whale opens Trove and deposits to SP
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: chicken, value: dec(50, 'ether') } })

      // deposit once
      const whaleLUSD = await lusdToken.balanceOf(chicken)
      await lusdToken.approve(bamm.address, whaleLUSD, { from: chicken })
      await bamm.deposit(dec(1000, 18), { from: chicken } )


      // send some ETH to simulate partial rebalance
      await web3.eth.sendTransaction({from: whale, to: bamm.address, value: toBN(dec(1, 18))})
      assert.equal(toBN(await web3.eth.getBalance(bamm.address)).toString(), toBN(dec(1, 18)).toString())

      // deposit again
      await bamm.deposit(dec(3000, 18), { from: chicken } )      

      // withdraw
      await bamm.withdraw(dec(4000, 18), A, {from: chicken})

      // check that lusd reached its destination
      assert.equal((await lusdToken.balanceOf(A)), dec(4000,18))

      // check that eth was not withdrew
      assert.equal(toBN(await web3.eth.getBalance(bamm.address)).toString(), toBN(dec(1, 18)).toString())  
    })

    it('price exceed max dicount and/or eth balance', async () => {
      // --- SETUP ---

      // Whale opens Trove and deposits to SP
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: chicken, value: dec(50, 'ether') } })
      
      const whaleLUSD = await lusdToken.balanceOf(chicken)
      await lusdToken.approve(bamm.address, whaleLUSD, { from: chicken })
      await bamm.deposit(toBN(dec(10000, 18)), { from: chicken } )

      // 2 Troves opened, each withdraws minimum debt
      await openTrove({ extraLUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1, } })
      await openTrove({ extraLUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2, } })


      // price drops: defaulter's Troves fall below MCR, whale doesn't
      await priceFeed.setPrice(dec(105, 18));

      // Troves are closed
      await troveManager.liquidate(defaulter_1, { from: owner })
      await troveManager.liquidate(defaulter_2, { from: owner })

      // 4k liquidations
      assert.equal(toBN(dec(6000, 18)).toString(), (await stabilityPool.getCompoundedLUSDDeposit(bamm.address)).toString())
      const ethGains = web3.utils.toBN("39799999999999999975")

      // without fee
      await bamm.setParams(20, 0, {from: bammOwner})
      const price = await bamm.getSwapEthAmount(dec(105, 18))
      assert.equal(price.ethAmount.toString(), dec(104, 18-2).toString())
      assert.equal(price.feeLusdAmount.toString(), "0")

      // with fee
      await bamm.setParams(20, 100, {from: bammOwner})
      const priceWithFee = await bamm.getSwapEthAmount(dec(105, 18))
      assert.equal(priceWithFee.ethAmount.toString(),price.ethAmount.toString())
      assert.equal(priceWithFee.feeLusdAmount.toString(), dec(105, 16))

      // without fee
      await bamm.setParams(20, 0, {from: bammOwner})
      const priceDepleted = await bamm.getSwapEthAmount(dec(1050000000000000, 18))
      assert.equal(priceDepleted.ethAmount.toString(), ethGains.toString())      
      assert.equal(priceDepleted.feeLusdAmount.toString(), "0")

      // with fee
      await bamm.setParams(20, 100, {from: bammOwner})
      const priceDepletedWithFee = await bamm.getSwapEthAmount(dec(1050000000000000, 18))
      assert.equal(priceDepletedWithFee.ethAmount.toString(), priceDepleted.ethAmount.toString())
      assert.equal(priceDepletedWithFee.feeLusdAmount.toString(), dec(1050000000000000, 16))      
    })

    it('test getSwapEthAmount', async () => {
      // --- SETUP ---

      // Whale opens Trove and deposits to SP
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: chicken, value: dec(50, 'ether') } })
      
      const whaleLUSD = await lusdToken.balanceOf(chicken)
      await lusdToken.approve(bamm.address, whaleLUSD, { from: chicken })
      await bamm.deposit(toBN(dec(10000, 18)), { from: chicken } )

      // 2 Troves opened, each withdraws minimum debt
      await openTrove({ extraLUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1, } })
      await openTrove({ extraLUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2, } })


      // price drops: defaulter's Troves fall below MCR, whale doesn't
      await priceFeed.setPrice(dec(105, 18));

      // Troves are closed
      await troveManager.liquidate(defaulter_1, { from: owner })
      await troveManager.liquidate(defaulter_2, { from: owner })

      // 4k liquidations
      assert.equal(toBN(dec(6000, 18)).toString(), (await stabilityPool.getCompoundedLUSDDeposit(bamm.address)).toString())
      const ethGains = web3.utils.toBN("39799999999999999975")

      const lusdQty = dec(105, 18)
      const expectedReturn = await bamm.getReturn(lusdQty, dec(6000, 18), toBN(dec(6000, 18)).add(ethGains.mul(toBN(2 * 105))), 200)

      // without fee
      await bamm.setParams(200, 0, {from: bammOwner})
      const priceWithoutFee = await bamm.getSwapEthAmount(lusdQty)
      assert.equal(priceWithoutFee.ethAmount.toString(), expectedReturn.mul(toBN(100)).div(toBN(100 * 105)).toString())
      assert.equal(priceWithoutFee.feeLusdAmount.toString(), "0")

      // with fee
      await bamm.setParams(200, 100, {from: bammOwner})
      const priceWithFee = await bamm.getSwapEthAmount(lusdQty)
      assert.equal(priceWithoutFee.ethAmount.toString(), priceWithFee.ethAmount.toString())      
      assert.equal(priceWithFee.feeLusdAmount.toString(), toBN(lusdQty).div(toBN("100")).toString())
      
      // with lusd price > 1
      await lusdChainlink.setPrice(dec(102,16)) // 1 lusd = 1.02 usd
      const priceWithLusdOver1 = await bamm.getSwapEthAmount(lusdQty)
      assert.equal(priceWithLusdOver1.ethAmount.toString(), toBN(priceWithoutFee.ethAmount).mul(toBN(102)).div(toBN(100)).toString())

      // with lusd price < 1
      await lusdChainlink.setPrice(dec(99,16)) // 1 lusd = 0.99 usd
      const priceWithLusdUnder1 = await bamm.getSwapEthAmount(lusdQty)
      assert.equal(priceWithLusdUnder1.ethAmount.toString(), priceWithoutFee.ethAmount.toString())

      // with lusd price >> 1
      await lusdChainlink.setPrice(dec(112,16)) // 1 lusd = 1.12 usd
      const priceWithLusdTooHigh = await bamm.getSwapEthAmount(lusdQty)
      assert.equal(priceWithLusdTooHigh.ethAmount.toString(), dec(104,16)) // get max discount, namely 1.04 ETH instead of 1 ETH

    })    

    it('test fetch price', async () => {
      await priceFeed.setPrice(dec(666, 18));
      assert.equal(await bamm.fetchPrice(), dec(666, 18))

      await chainlink.setTimestamp(888)
      assert.equal((await bamm.fetchPrice()).toString(), "0")      
    })

    it('test swap', async () => {
      // --- SETUP ---

      // Whale opens Trove and deposits to SP
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: chicken, value: dec(50, 'ether') } })
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: whale, value: dec(50, 'ether') } })      
      
      const whaleLUSD = await lusdToken.balanceOf(chicken)
      await lusdToken.approve(bamm.address, whaleLUSD, { from: chicken })
      
      await bamm.deposit(toBN(dec(10000, 18)), { from: chicken } )

      // 2 Troves opened, each withdraws minimum debt
      await openTrove({ extraLUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1, } })
      await openTrove({ extraLUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2, } })


      // price drops: defaulter's Troves fall below MCR, whale doesn't
      await priceFeed.setPrice(dec(105, 18));

      // Troves are closed
      await troveManager.liquidate(defaulter_1, { from: owner })
      await troveManager.liquidate(defaulter_2, { from: owner })

      // 4k liquidations
      assert.equal(toBN(dec(6000, 18)).toString(), (await stabilityPool.getCompoundedLUSDDeposit(bamm.address)).toString())
      const ethGains = web3.utils.toBN("39799999999999999975")

      // with fee
      await bamm.setParams(20, 100, {from: bammOwner})
      const priceWithFee = await bamm.getSwapEthAmount(dec(105, 18))
      assert.equal(priceWithFee.ethAmount.toString(), dec(104, 18-2).toString())
      assert.equal(priceWithFee.feeLusdAmount.toString(), dec(105, 16).toString())      

      await lusdToken.approve(bamm.address, dec(105,18), {from: whale})
      const dest = "0xdEADBEEF00AA81bBCF694bC5c05A397F5E5658D5"

      await assertRevert(bamm.swap(dec(105,18), priceWithFee.ethAmount.add(toBN(1)), dest, {from: whale}), 'swap: low return')      
      await bamm.swap(dec(105,18), priceWithFee.ethAmount, dest, {from: whale}) // TODO - check once with higher value so it will revert

      // check lusd balance
      const expectedPoolBalance = toBN(dec(6105, 18)).sub(priceWithFee.feeLusdAmount)
      assert.equal(expectedPoolBalance.toString(), (await stabilityPool.getCompoundedLUSDDeposit(bamm.address)).toString())

      // check eth balance
      assert.equal(await web3.eth.getBalance(dest), priceWithFee.ethAmount)

      // check fees
      assert.equal((await lusdToken.balanceOf(feePool)).toString(), priceWithFee.feeLusdAmount.toString())
    })    

    it('test set params happy path', async () => {
      // --- SETUP ---

      // Whale opens Trove and deposits to SP
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: chicken, value: dec(50, 'ether') } })

      
      const whaleLUSD = await lusdToken.balanceOf(chicken)
      await lusdToken.approve(bamm.address, whaleLUSD, { from: chicken })
      await bamm.deposit(toBN(dec(10000, 18)), { from: chicken } )

      // 2 Troves opened, each withdraws minimum debt
      await openTrove({ extraLUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1, } })
      await openTrove({ extraLUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2, } })


      // price drops: defaulter's Troves fall below MCR, whale doesn't
      await priceFeed.setPrice(dec(105, 18));

      // Troves are closed
      await troveManager.liquidate(defaulter_1, { from: owner })
      await troveManager.liquidate(defaulter_2, { from: owner })

      // 4k liquidations
      assert.equal(toBN(dec(6000, 18)).toString(), (await stabilityPool.getCompoundedLUSDDeposit(bamm.address)).toString())
      const ethGains = web3.utils.toBN("39799999999999999975")

      const lusdQty = dec(105, 18)
      const expectedReturn200 = await bamm.getReturn(lusdQty, dec(6000, 18), toBN(dec(6000, 18)).add(ethGains.mul(toBN(2 * 105))), 200)
      const expectedReturn190 = await bamm.getReturn(lusdQty, dec(6000, 18), toBN(dec(6000, 18)).add(ethGains.mul(toBN(2 * 105))), 190)      

      assert(expectedReturn200.toString() !== expectedReturn190.toString())

      // without fee
      await bamm.setParams(200, 0, {from: bammOwner})
      const priceWithoutFee = await bamm.getSwapEthAmount(lusdQty)
      assert.equal(priceWithoutFee.ethAmount.toString(), expectedReturn200.mul(toBN(100)).div(toBN(100 * 105)).toString())
      assert.equal(priceWithoutFee.feeLusdAmount.toString(), "0")

      // with fee
      await bamm.setParams(190, 100, {from: bammOwner})
      const priceWithFee = await bamm.getSwapEthAmount(lusdQty)
      assert.equal(priceWithFee.ethAmount.toString(), expectedReturn190.mul(toBN(100)).div(toBN(100 * 105)).toString())
      assert.equal(priceWithFee.feeLusdAmount.toString(), toBN(lusdQty).div(toBN("100")).toString())            
    })    
    
    it('test set chicken sad path', async () => {
      await assertRevert(bamm.setChicken(bob, {from: alice}), 'Ownable: caller is not the owner')
      await assertRevert(bamm.setChicken(ZERO_ADDRESS, {from: bammOwner}), 'setChicken: null address')
      await assertRevert(bamm.setChicken(bob, {from: bammOwner}), 'setChicken: already set')
    })
    
    it('test set params sad path', async () => {
      await assertRevert(bamm.setParams(210, 100, {from: bammOwner}), 'setParams: A too big')
      await assertRevert(bamm.setParams(9, 100, {from: bammOwner}), 'setParams: A too small')
      await assertRevert(bamm.setParams(10, 101, {from: bammOwner}), 'setParams: fee is too big')             
      await assertRevert(bamm.setParams(20, 100, {from: B}), 'Ownable: caller is not the owner')      
    })

    it('deposit/withdraw not from chicken', async () => {
      await assertRevert(bamm.deposit(210, {from: A}), 'BAMM: caller is not the chicken')
      await assertRevert(bamm.withdraw(210, A, {from: A}), 'BAMM: caller is not the chicken')      
    })

    it('getLUSDValue', async () => {
      // --- SETUP ---

      // Whale opens Trove and deposits to SP
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: chicken, value: dec(50, 'ether') } })
      const whaleLUSD = dec(10000, 18)
      await lusdToken.approve(bamm.address, whaleLUSD, { from: chicken })
      await bamm.deposit(whaleLUSD, { from: chicken } )

      // 2 Troves opened, each withdraws minimum debt
      await openTrove({ extraLUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1, } })

      // price drops: defaulter's Troves fall below MCR, whale doesn't
      await priceFeed.setPrice(dec(105, 18));

      // Troves are closed
      await troveManager.liquidate(defaulter_1, { from: owner })

      // send some ETH
      await web3.eth.sendTransaction({from: whale, to: bamm.address, value: toBN(dec(1, 18))})

      const expectedLUSD = await stabilityPool.getCompoundedLUSDDeposit(bamm.address)
      const expectedETH = toBN(await stabilityPool.getDepositorETHGain(bamm.address)).add(toBN(dec(1, 18)))
      const expectedETHValue = expectedETH.mul(toBN(105))
      const expectedTotal = toBN(expectedLUSD).add(toBN(expectedETHValue))

      // total value should be 105 + liquidated trove size
      const lusdValue = await bamm.getLUSDValue()

      assert.equal(lusdValue.totalLUSDValue.toString(), expectedTotal.toString())
      assert.equal(lusdValue.lusdBalance.toString(), expectedLUSD.toString())
      assert.equal(lusdValue.ethLUSDValue.toString(), expectedETHValue.toString())            
    })

    it('setSeller sad paths', async () => {
      // call without set pending
      await assertRevert(bamm.setSeller(alice, {from: bammOwner}), 'setSeller: ! pending')

      // call from non owner
      const nonOwner = alice
      await assertRevert(bamm.setSeller(alice, {from: nonOwner}), 'Ownable: caller is not the owner')
      await assertRevert(bamm.setPendingSeller(bob, {from: nonOwner}), 'Ownable: caller is not the owner')
      
      // set new pending, and then call ahead of time, and with wrong seller
      const pendingSeller = carol
      const nonPendingSeller = defaulter_3
      await bamm.setPendingSeller(pendingSeller, {from: bammOwner})

      // ahead of time
      await assertRevert(bamm.setSeller(pendingSeller, {from: bammOwner}), 'setSeller: too early')
      
      // move fwd 1 month
      await th.fastForwardTime(30 * 24 * 60 * 60, web3.currentProvider)

      // set wrong seller
      await assertRevert(bamm.setSeller(nonPendingSeller, {from: bammOwner}), 'setSeller: ! pending')    
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
       assert.include(err.message, message, "actual: " + err.message + " ### expected: " + message)
    }
  }
}