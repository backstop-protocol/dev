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
  let priceFeed
  let lusdToken
  let bamm
  let lens
  let chainlink

  let gasPriceInWei

  let cETH
  let cLUSD

  const feePool = "0x1000000000000000000000000000000000000001"

  //const assertRevert = th.assertRevert

  describe("BAMM", async () => {

    before(async () => {
      gasPriceInWei = await web3.eth.getGasPrice()
    })

    beforeEach(async () => {
      contracts = await deploymentHelper.deployLiquityCore()

      priceFeed = contracts.priceFeedTestnet
      // Register 3 front ends
      //await th.registerFrontEnds(frontEnds, stabilityPool)

      // deploy BAMM
      chainlink = await ChainlinkTestnet.new(priceFeed.address)
      lusdToken = await MockToken.new(7)
      cETH = await MockCToken.new(lusdToken.address, true)
      cLUSD = await MockCToken.new(lusdToken.address, false)   


      bamm = await BAMM.new(chainlink.address,
                            lusdToken.address,
                            cETH.address,
                            cLUSD.address,
                            400,
                            feePool,
                            {from: bammOwner})
    })

    it.only("liquidateBorrow", async () => {
      const liquidationAmount = toBN(dec(1000, 7))
      const collateralAmount = liquidationAmount.mul(toBN(3))
      await lusdToken.mintToken(shmuel, liquidationAmount, {from: shmuel})
      await lusdToken.mintToken(yaron, collateralAmount, {from: yaron})
      await lusdToken.approve(cLUSD.address, liquidationAmount, {from: shmuel})
      await lusdToken.approve(cETH.address, collateralAmount, {from: yaron})
      await cETH.depositToken(collateralAmount, {from: yaron})

      await cLUSD.setCETHPrice(toBN(dec(3, 18)))
      
      await cLUSD.liquidateBorrow(yaron, liquidationAmount, cETH.address, {from: shmuel})
      const shmuelsCEthBalance = await cETH.balanceOf(shmuel)
      assert.equal(shmuelsCEthBalance.toString(), collateralAmount.toString())
    })

    // --- provideToSP() ---
    // increases recorded LUSD at Stability Pool
    it("deposit(): increases the Stability Pool LUSD balance", async () => {
      // --- SETUP --- Give Alice a least 200
      await lusdToken.mintToken(alice, toBN(200), {from: alice})

      // --- TEST ---
      await lusdToken.approve(bamm.address, toBN(200), { from: alice })
      await bamm.deposit(toBN(200), { from: alice })

      // check LUSD balances after
      const bamm_LUSD_After = await lusdToken.balanceOf(bamm.address)
      assert.equal(bamm_LUSD_After, 200)
    })

    // --- provideToSP() ---
    // increases recorded LUSD at Stability Pool
    it("deposit(): two users deposit, check their share", async () => {
      // --- SETUP --- Give Alice and whale at least 200
      await lusdToken.mintToken(alice, toBN(200), {from: alice})
      await lusdToken.mintToken(whale, toBN(200), {from: alice})      

      // --- TEST ---
      await lusdToken.approve(bamm.address, toBN(200), { from: alice })
      await lusdToken.approve(bamm.address, toBN(200), { from: whale })      
      await bamm.deposit(toBN(200), { from: alice })
      await bamm.deposit(toBN(200), { from: whale })      

      // check LUSD balances after1
      const whaleShare = await bamm.balanceOf(whale)
      const aliceShare = await bamm.balanceOf(alice)

      assert.equal(whaleShare.toString(), aliceShare.toString())
    })

    // --- provideToSP() ---
    // increases recorded LUSD at Stability Pool
    it("deposit(): two users deposit, one withdraw. check their share", async () => {
      // --- SETUP --- Give Alice and whale at least 200
      await lusdToken.mintToken(alice, toBN(200), {from: alice})
      await lusdToken.mintToken(whale, toBN(200), {from: alice})           

      // --- TEST ---
      await lusdToken.approve(bamm.address, toBN(200), { from: alice })
      await lusdToken.approve(bamm.address, toBN(100), { from: whale })      
      await bamm.deposit(toBN(200), { from: alice })
      await bamm.deposit(toBN(100), { from: whale })      

      // check LUSD balances after1
      const whaleShare = await bamm.balanceOf(whale)
      const aliceShare = await bamm.balanceOf(alice)

      assert.equal(whaleShare.mul(toBN(2)).toString(), aliceShare.toString())

      const whaleBalanceBefore = await lusdToken.balanceOf(whale)
      const shareToWithdraw = whaleShare.div(toBN(2));
      await bamm.withdraw(shareToWithdraw, { from: whale });

      const newWhaleShare = await bamm.balanceOf(whale)
      assert.equal(newWhaleShare.mul(toBN(2)).toString(), whaleShare.toString())

      const whaleBalanceAfter = await lusdToken.balanceOf(whale)
      assert.equal(whaleBalanceAfter.sub(whaleBalanceBefore).toString(), 50)      
    })

    it('test share with ether', async () => {
      // --- SETUP ---

      await lusdToken.mintToken(whale, toBN(dec(100000, 7)), {from: whale})
      await lusdToken.mintToken(A, toBN(dec(100000, 7)), {from: A})
      await lusdToken.mintToken(B, toBN(dec(100000, 7)), {from: B})
            
      const whaleLUSD = await lusdToken.balanceOf(whale)
      await lusdToken.approve(bamm.address, whaleLUSD, { from: whale })
      await lusdToken.approve(bamm.address, toBN(dec(6000, 18)), { from: A })
      await bamm.deposit(toBN(dec(6000, 7)), { from: A } )

      // send 60 ETH to bamm, mimics liquidations
      await web3.eth.sendTransaction({from: whale, to: bamm.address, value: toBN(dec(60, 18))})

      // price set, 1 ETH = 100 USD
      await priceFeed.setPrice(dec(100, 18));

      assert.equal(toBN(dec(6000, 7)).toString(), (await lusdToken.balanceOf(bamm.address)).toString())
      assert.equal(toBN(dec(60, 18)).toString(), (await web3.eth.getBalance(bamm.address)).toString())      

      const totalUsd = toBN(dec(6000 * 2, 7))

      await lusdToken.approve(bamm.address, totalUsd, { from: B })       
      await bamm.deposit(totalUsd, { from: B } )      

      assert.equal((await bamm.balanceOf(A)).toString(), (await bamm.balanceOf(B)).toString())

      const ethBalanceBefore = toBN(await web3.eth.getBalance(A))
      const LUSDBefore = await lusdToken.balanceOf(A)
      await bamm.withdraw(await bamm.balanceOf(A), {from: A})
      const ethBalanceAfter = toBN(await web3.eth.getBalance(A))
      const LUSDAfter = await lusdToken.balanceOf(A)

      assert.equal(toBN(dec((6000 + 6000 * 2) / 2, 7)).toString(), LUSDAfter.sub(LUSDBefore).toString())

      const expectedDelaEth = toBN(dec(60 / 2, 18))
      const realDeltaEth = ethBalanceAfter.sub(ethBalanceBefore) // this includes gas costs

      assert(expectedDelaEth.gt(realDeltaEth), "eth should be lower")
      assert(realDeltaEth.add(toBN(dec(1,16))).gt(expectedDelaEth), "eth should be higher")
    })

    it('price exceed max dicount and/or eth balance', async () => {
      await lusdToken.mintToken(A, toBN(dec(100000, 7)), {from: whale})      
      await lusdToken.approve(bamm.address, toBN(dec(10000, 7)), { from: A })
      await bamm.deposit(toBN(dec(6000, 7)), { from: A } )

      // price drops: defaulter's Troves fall below MCR, whale doesn't
      await priceFeed.setPrice(dec(105, 18));

      // 4k liquidations
      assert.equal(toBN(dec(6000, 7)).toString(), (await lusdToken.balanceOf(bamm.address)).toString())

      // send ETH to bamm, mimics liquidations
      const ethGains = web3.utils.toBN("39799999999999999975")      
      await web3.eth.sendTransaction({from: whale, to: bamm.address, value: ethGains})

      // without fee
      await bamm.setParams(20, 0, 0, {from: bammOwner})
      const price = await bamm.getSwapEthAmount(dec(105, 18 - 11))
      assert.equal(price.toString(), dec(104, 18-2).toString())

      // with fee - should be the same, as fee is on the lusd
      await bamm.setParams(20, 100, 0, {from: bammOwner})
      const priceWithFee = await bamm.getSwapEthAmount(dec(105, 18 - 11))
      assert.equal(price.toString(), dec(104, 18-2).toString())

      // without fee
      await bamm.setParams(20, 0, 0, {from: bammOwner})
      const priceDepleted = await bamm.getSwapEthAmount(dec(1050000000000000, 18 - 11))
      assert.equal(priceDepleted.toString(), ethGains.toString())      

      // with fee - should be the same
      await bamm.setParams(20, 100, 0, {from: bammOwner})
      const priceDepletedWithFee = await bamm.getSwapEthAmount(dec(1050000000000000, 18 - 11))
      assert.equal(priceDepletedWithFee.toString(), ethGains.toString())
    })

    it('test getSwapEthAmount', async () => {
      await lusdToken.mintToken(A, toBN(dec(100000, 7)), {from: whale})      
      await lusdToken.approve(bamm.address, toBN(dec(10000, 7)), { from: A })
      await bamm.deposit(toBN(dec(6000, 7)), { from: A } )

      // price drops: defaulter's Troves fall below MCR, whale doesn't
      await priceFeed.setPrice(dec(105, 18));

      // 4k liquidations
      assert.equal(toBN(dec(6000, 7)).toString(), (await lusdToken.balanceOf(bamm.address)).toString())

      // send ETH to bamm, mimics liquidations
      const ethGains = toBN(dec(4,18))  
      await web3.eth.sendTransaction({from: whale, to: bamm.address, value: ethGains})

      const lusdQty = dec(105, 7)
      const expectedReturn = await bamm.getReturn(lusdQty, dec(6000, 7), toBN(dec(6000, 7)).add(toBN(dec(2 * 4 * 105, 7))), 200)

      // without fee
      await bamm.setParams(200, 0, 0, {from: bammOwner})
      const priceWithoutFee = await bamm.getSwapEthAmount(lusdQty)
      assert.equal(priceWithoutFee.toString(), expectedReturn.mul(toBN(dec(1,11))).mul(toBN(100)).div(toBN(100 * 105)).toString())

      // with fee
      await bamm.setParams(200, 100, 0, {from: bammOwner})
      const priceWithFee = await bamm.getSwapEthAmount(lusdQty)
      assert.equal(priceWithFee.toString(), expectedReturn.mul(toBN(dec(1,11))).mul(toBN(100)).div(toBN(100 * 105)).toString())      
    })    

    it('test fetch price', async () => {
      await priceFeed.setPrice(dec(666, 18));
      assert.equal(await bamm.fetchPrice(), dec(666, 7))

      await chainlink.setTimestamp(888)
      assert.equal((await bamm.fetchPrice()).toString(), "0")      
    })

    it('test swap', async () => {
      await lusdToken.mintToken(A, toBN(dec(100000, 7)), {from: whale})
      await lusdToken.mintToken(whale, toBN(dec(100000, 7)), {from: whale})      

      await lusdToken.approve(bamm.address, toBN(dec(10000, 7)), { from: A })
      await lusdToken.approve(bamm.address, toBN(dec(10000, 7)), { from: whale })

      await bamm.deposit(toBN(dec(6000, 7)), { from: A } )

      // price drops: defaulter's Troves fall below MCR, whale doesn't
      await priceFeed.setPrice(dec(105, 18));

      // 4k liquidations
      assert.equal(toBN(dec(6000, 7)).toString(), (await lusdToken.balanceOf(bamm.address)).toString())

      // send ETH to bamm, mimics liquidations
      const ethGains = web3.utils.toBN("39799999999999999975") 
      await web3.eth.sendTransaction({from: whale, to: bamm.address, value: ethGains})

      // with fee
      await bamm.setParams(20, 100, 0, {from: bammOwner})
      const priceWithFee = await bamm.getSwapEthAmount(dec(105, 7))
      assert.equal(priceWithFee.toString(), toBN(dec(10296, 18-4)).add(toBN(dec(10400 - 10296, 18-4))).toString())

      await lusdToken.approve(bamm.address, dec(105,7), {from: whale})
      const dest = "0xdEADBEEF00AA81bBCF694bC5c05A397F5E5658D5"

      await assertRevert(bamm.swap(dec(105,7), priceWithFee.add(toBN(1)), dest, {from: whale}), 'swap: low return')      
      await bamm.swap(dec(105,7), priceWithFee, dest, {from: whale}) // TODO - check once with higher value so it will revert

      const fees = toBN(dec(105,7)).div(toBN(100))

      // check lusd balance
      assert.equal(toBN(dec(6105, 7)).toString(), (await lusdToken.balanceOf(bamm.address)).add(fees).toString())

      // check eth balance
      assert.equal(await web3.eth.getBalance(dest), priceWithFee)

      // check fees
      assert.equal((await lusdToken.balanceOf(await bamm.feePool())).toString(), fees)
    })    

    it('test set params happy path', async () => {
      // --- SETUP ---

      await lusdToken.mintToken(A, toBN(dec(100000, 7)), {from: whale})
      await lusdToken.mintToken(whale, toBN(dec(100000, 7)), {from: whale})      

      await lusdToken.approve(bamm.address, toBN(dec(10000, 7)), { from: A })
      await lusdToken.approve(bamm.address, toBN(dec(10000, 7)), { from: whale })

      await bamm.deposit(toBN(dec(6000, 7)), { from: A } )

      // price drops: defaulter's Troves fall below MCR, whale doesn't
      await priceFeed.setPrice(dec(105, 18));

      // 4k liquidations
      assert.equal(toBN(dec(6000, 7)).toString(), (await lusdToken.balanceOf(bamm.address)).toString())

      // send ETH to bamm, mimics liquidations
      const ethGains = web3.utils.toBN("39799999999999999975") 
      await web3.eth.sendTransaction({from: whale, to: bamm.address, value: ethGains})


      // price drops: defaulter's Troves fall below MCR, whale doesn't
      await priceFeed.setPrice(dec(105, 18));

      const lusdQty = dec(105, 7)
      const expectedReturn200 = await bamm.getReturn(lusdQty, dec(6000, 7), toBN(dec(6000, 7)).add(ethGains.mul(toBN(2 * 105)).div(toBN(dec(1,11)))), 200)
      const expectedReturn190 = await bamm.getReturn(lusdQty, dec(6000, 7), toBN(dec(6000, 7)).add(ethGains.mul(toBN(2 * 105)).div(toBN(dec(1,11)))), 190)

      assert(expectedReturn200.toString() !== expectedReturn190.toString())

      // without fee
      await bamm.setParams(200, 0, 0, {from: bammOwner})
      const priceWithoutFee = await bamm.getSwapEthAmount(lusdQty)
      assert.equal(priceWithoutFee.div(toBN(dec(1,11))).toString(), expectedReturn200.mul(toBN(100)).div(toBN(100 * 105)).toString())

      // with fee
      await bamm.setParams(190, 100, 0, {from: bammOwner})
      const priceWithFee = await bamm.getSwapEthAmount(lusdQty)
      assert.equal(priceWithFee.div(toBN(dec(1,11))).toString(), expectedReturn190.mul(toBN(100)).div(toBN(100 * 105)).toString())

      // TODO - with caller fee
    })    
    
    it('test set params sad path', async () => {
      await assertRevert(bamm.setParams(210, 100, 50, {from: bammOwner}), 'setParams: A too big')
      await assertRevert(bamm.setParams(10, 100, 50, {from: bammOwner}), 'setParams: A too small')
      await assertRevert(bamm.setParams(10, 101, 50, {from: bammOwner}), 'setParams: fee is too big')
      await assertRevert(bamm.setParams(10, 100, 150, {from: bammOwner}), 'setParams: caller fee is too big')      
      await assertRevert(bamm.setParams(20, 100, 50, {from: B}), 'Ownable: caller is not the owner')      
    })

    it.skip('transfer happy test', async () => { // transfer is not supported anymore
      // --- SETUP ---

      // Whale opens Trove and deposits to SP
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: whale, value: dec(50, 'ether') } })
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: A } })
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: C } })
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: D } })            
      
      const whaleLUSD = await lusdToken.balanceOf(whale)
      await lusdToken.approve(bamm.address, whaleLUSD, { from: whale })
      await lusdToken.approve(bamm.address, toBN(dec(10000, 18)), { from: A })
      await bamm.deposit(toBN(dec(10000, 18)), { from: A } )
      await stabilityPool.provideToSP(toBN(dec(10000, 18)), frontEnd_1, {from: C})

      assert.equal(await bamm.balanceOf(A), dec(1, 18))

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      await stabilityPool.provideToSP(toBN(dec(5000, 18)), frontEnd_1, {from: D})      

      await bamm.transfer(B, dec(5, 17), {from: A})
      assert.equal(await bamm.balanceOf(A), dec(5, 17))
      assert.equal(await bamm.balanceOf(B), dec(5, 17))

      await stabilityPool.withdrawFromSP(toBN(dec(5000, 18)), { from: C })
      assert.equal(await lqtyToken.balanceOf(B), "0")
      await bamm.withdraw(0, {from: A})
      assert.equal((await lqtyToken.balanceOf(A)).toString(), (await lqtyToken.balanceOf(C)).toString())

      // reset A's usd balance
      await lusdToken.transfer(C, await lusdToken.balanceOf(A), {from: A})
      assert.equal(await lusdToken.balanceOf(A), "0")

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)      

      await bamm.withdraw(toBN(dec(5, 17)), {from: A}) // check balance
      await bamm.withdraw(toBN(dec(5, 17)), {from: B}) // check balance
      await stabilityPool.withdrawFromSP(toBN(dec(5000, 18)), { from: C })
      await stabilityPool.withdrawFromSP(toBN(dec(5000, 18)), { from: D })      

      assert.equal((await lqtyToken.balanceOf(B)).toString(), (await lqtyToken.balanceOf(D)).toString())      
      assert.equal((await lqtyToken.balanceOf(A)).toString(), (await lqtyToken.balanceOf(C)).toString())      

      assert.equal((await lusdToken.balanceOf(B)).toString(), dec(5000, 18))            
      assert.equal((await lusdToken.balanceOf(A)).toString(), dec(5000, 18))
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