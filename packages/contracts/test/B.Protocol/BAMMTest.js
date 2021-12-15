const { assert } = require("hardhat")
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

  let priceFeed0
  let priceFeed1
  let priceFeed2

  let lusdToken
  let bamm
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

      token0 = await MockToken.new(12)
      token1 = await MockToken.new(13)
      token2 = await MockToken.new(4)

      cToken0 = await MockCToken.new(token0.address, false)
      cToken1 = await MockCToken.new(token1.address, false)
      cToken2 = await MockCToken.new(token2.address, false)
      
      priceFeed0 = await ChainlinkTestnet.new()
      priceFeed1 = await ChainlinkTestnet.new()
      priceFeed2 = await ChainlinkTestnet.new()

      bamm = await BAMM.new(lusdToken.address,
                            cLUSD.address,
                            400,
                            feePool,
                            {from: bammOwner})

      await bamm.addCollateral(cToken0.address, priceFeed0.address, {from: bammOwner})
      await bamm.addCollateral(cToken1.address, priceFeed1.address, {from: bammOwner})
      await bamm.addCollateral(cToken2.address, priceFeed2.address, {from: bammOwner})
    })

    it("liquidateBorrow bamm", async () => {
      await bamm.setParams(20, 100, 50, {from: bammOwner})
      const liquidationAmount = toBN(dec(1000, 7))
      const collateralAmount = toBN(dec(3000, 12))
      await lusdToken.mintToken(shmuel, liquidationAmount, {from: shmuel})
      await lusdToken.approve(bamm.address, liquidationAmount, {from: shmuel})
      await bamm.deposit(liquidationAmount, {from: shmuel})

      await token0.mintToken(yaron, collateralAmount)
      await token0.approve(cToken0.address, collateralAmount, {from: yaron})
      await cToken0.depositToken(collateralAmount, {from: yaron})

      const callerToken0BalanceBefore = toBN(await token0.balanceOf(shmuel))

      const expectedCallerFee = collateralAmount.div(toBN(200)) // 0.5%
      await cLUSD.setPrice(toBN(dec(3, 18 + 12 - 7)))

      await bamm.liquidateBorrow(yaron, liquidationAmount, cToken0.address, {from: shmuel})
      
      const callerToken0BalanceAfter = toBN(await token0.balanceOf(shmuel))
      const bammToken0Balance = await token0.balanceOf(bamm.address)
      const expectdToken0Balance = collateralAmount.sub(expectedCallerFee)
      assert.equal(expectdToken0Balance.toString(), bammToken0Balance.toString())
      const bammLusdBalance = await lusdToken.balanceOf(bamm.address)
      assert.equal(bammLusdBalance.toString(), "0")
      const callerToken0Delta = callerToken0BalanceAfter.sub(callerToken0BalanceBefore)
      assert.equal(expectedCallerFee.toString(), callerToken0Delta.toString())
    })

    it("liquidateLUSD with LUSD", async () => {
      await bamm.setParams(20, 100, 50, {from: bammOwner})
      const liquidationAmount = toBN(dec(1000, 7))
      const collateralAmount = toBN(dec(2000, 7))
      await lusdToken.mintToken(shmuel, liquidationAmount, {from: shmuel})
      await lusdToken.approve(bamm.address, liquidationAmount, {from: shmuel})
      await bamm.deposit(liquidationAmount, {from: shmuel})

      await lusdToken.mintToken(yaron, collateralAmount)
      await lusdToken.approve(cLUSD.address, collateralAmount, {from: yaron})
      await cLUSD.depositToken(collateralAmount, {from: yaron})

      // in LUSD <> LUSD the fee is from the 
      const expectedCallerFee = liquidationAmount.div(toBN(200)) // 0.5%
      await cLUSD.setPrice(toBN(dec(2, 18)))

      const shmuelLusdBefore = await lusdToken.balanceOf(shmuel)
      await bamm.liquidateBorrow(yaron, liquidationAmount, cLUSD.address, {from: shmuel})
      const shmuelLusdAfter = await lusdToken.balanceOf(shmuel)      

      assert.equal(expectedCallerFee.toString(), shmuelLusdAfter.sub(shmuelLusdBefore).toString())

      const bammLusdBalance = await lusdToken.balanceOf(bamm.address)
      const expectdLusdBalance = collateralAmount.sub(expectedCallerFee)
      assert.equal(expectdLusdBalance.toString(), bammLusdBalance.toString())
    })    
    
    it("canLiquidate", async ()=> {
      const liquidationAmount = toBN(dec(1000, 7))

      await lusdToken.mintToken(shmuel, liquidationAmount, {from: shmuel})
      await lusdToken.approve(bamm.address, liquidationAmount, {from: shmuel})
      await bamm.deposit(liquidationAmount, {from: shmuel})

      // valid liquidations
      let canLiquidate = await bamm.canLiquidate(cLUSD.address, cToken0.address, liquidationAmount)
      assert.equal(canLiquidate, true)
      canLiquidate = await bamm.canLiquidate(cLUSD.address, cToken1.address, liquidationAmount)
      assert.equal(canLiquidate, true)
      canLiquidate = await bamm.canLiquidate(cLUSD.address, cToken2.address, liquidationAmount)
      assert.equal(canLiquidate, true)

      // invalid ctoken
      const cToken3 = await MockCToken.new((await MockToken.new(1)).address, false)

      canLiquidate = await bamm.canLiquidate(cLUSD.address, cToken3.address, liquidationAmount)
      assert.equal(canLiquidate, false)      

      // amount exceeded
      canLiquidate = await bamm.canLiquidate(cLUSD.address, cToken2.address, liquidationAmount.add(toBN(1)))
      assert.equal(canLiquidate, false)

      // borrow = collateral
      canLiquidate = await bamm.canLiquidate(cLUSD.address, cLUSD.address, liquidationAmount)
      assert.equal(canLiquidate, true)
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

    it('test share with collateral', async () => {
      // --- SETUP ---

      await lusdToken.mintToken(whale, toBN(dec(100000, 7)), {from: whale})
      await lusdToken.mintToken(A, toBN(dec(100000, 7)), {from: A})
      await lusdToken.mintToken(B, toBN(dec(100000, 7)), {from: B})
            
      const whaleLUSD = await lusdToken.balanceOf(whale)
      await lusdToken.approve(bamm.address, whaleLUSD, { from: whale })
      await lusdToken.approve(bamm.address, toBN(dec(6000, 7)), { from: A })
      await bamm.deposit(toBN(dec(6000, 7)), { from: A } )

      // send $6k collateral to bamm, mimics liquidations
      await token0.mintToken(bamm.address, toBN(dec(1000, 12))) // $3k
      await token1.mintToken(bamm.address, toBN(dec(200, 13))) // $1k
      await token2.mintToken(bamm.address, toBN(dec(500, 4))) // $2k

      // price set so that total collateral is $6k
      await priceFeed0.setPrice(dec(3, 18));
      await priceFeed1.setPrice(dec(5, 18));
      await priceFeed2.setPrice(dec(4, 18));


      assert.equal(toBN(dec(6000, 7)).toString(), (await lusdToken.balanceOf(bamm.address)).toString())
      const collateralValue = await bamm.getCollateralValue()
      assert.equal((collateralValue.value).toString(), toBN(dec(6000, 7)).toString(), "unexpected collateral value")

      const totalUsd = toBN(dec(6000 * 2, 7))

      await lusdToken.approve(bamm.address, totalUsd, { from: B })       
      await bamm.deposit(totalUsd, { from: B } )      

      assert.equal((await bamm.balanceOf(A)).toString(), (await bamm.balanceOf(B)).toString())

      const token0BalBefore = toBN(await token0.balanceOf(A))
      const token1BalBefore = toBN(await token1.balanceOf(A))
      const token2BalBefore = toBN(await token2.balanceOf(A))

      const LUSDBefore = await lusdToken.balanceOf(A)

      await bamm.withdraw(await bamm.balanceOf(A), {from: A})

      const LUSDAfter = await lusdToken.balanceOf(A)

      const token0BalAfter = toBN(await token0.balanceOf(A))
      const token1BalAfter = toBN(await token1.balanceOf(A))
      const token2BalAfter = toBN(await token2.balanceOf(A))


      // LUSD
      assert.equal(toBN(dec((6000 + 6000 * 2) / 2, 7)).toString(), LUSDAfter.sub(LUSDBefore).toString())

      // token 0-2
      assert.equal(toBN(dec(500, 12)).toString(), token0BalAfter.sub(token0BalBefore).toString())
      assert.equal(toBN(dec(100, 13)).toString(), token1BalAfter.sub(token1BalBefore).toString())
      assert.equal(toBN(dec(250, 4)).toString(), token2BalAfter.sub(token2BalBefore).toString())
    })

    it('price exceed max dicount and/or collateral balance', async () => {
      await lusdToken.mintToken(A, toBN(dec(100000, 7)), {from: whale})      
      await lusdToken.approve(bamm.address, toBN(dec(10000, 7)), { from: A })
      await bamm.deposit(toBN(dec(6000, 7)), { from: A } )

      // price drops: defaulter's Troves fall below MCR, whale doesn't
      await priceFeed0.setPrice(dec(105, 18));

      // 4k liquidations
      assert.equal(toBN(dec(6000, 7)).toString(), (await lusdToken.balanceOf(bamm.address)).toString())

      // send ETH to bamm, mimics liquidations
      const ethGains = web3.utils.toBN("39799999999999")
      await token0.mintToken(bamm.address, ethGains)

      // without fee
      await bamm.setParams(20, 0, 0, {from: bammOwner})
      const price = await bamm.getSwapAmount(dec(105, 7), token0.address)
      assert.equal(price.toString(), dec(104, 12 - 2).toString())

      // with fee - should be the same, as fee is on the lusd
      await bamm.setParams(20, 100, 0, {from: bammOwner})
      const priceWithFee = await bamm.getSwapAmount(dec(105, 7), token0.address)
      assert.equal(price.toString(), dec(104, 12 - 2).toString())

      // without fee
      await bamm.setParams(20, 0, 0, {from: bammOwner})
      const priceDepleted = await bamm.getSwapAmount(dec(1050000000000000, 7), token0.address)
      assert.equal(priceDepleted.toString(), ethGains.toString())      

      // with fee - should be the same
      await bamm.setParams(20, 100, 0, {from: bammOwner})
      const priceDepletedWithFee = await bamm.getSwapAmount(dec(1050000000000000, 7), token0.address)
      assert.equal(priceDepletedWithFee.toString(), ethGains.toString())
    })

    it('test getSwapAmount', async () => {
      await lusdToken.mintToken(A, toBN(dec(100000, 7)), {from: whale})      
      await lusdToken.approve(bamm.address, toBN(dec(10000, 7)), { from: A })
      await bamm.deposit(toBN(dec(6000, 7)), { from: A } )

      await priceFeed0.setPrice(dec(105, 18), {from: bammOwner});
      await priceFeed1.setPrice(dec(90, 18), {from: bammOwner});
      await priceFeed2.setPrice(dec(120, 18), {from: bammOwner});      

      assert.equal(toBN(dec(6000, 7)).toString(), (await lusdToken.balanceOf(bamm.address)).toString())

      // send ETH to bamm, mimics liquidations. total of 420 usd
      await token0.mintToken(bamm.address, toBN(dec(2, 12)))
      await token1.mintToken(bamm.address, toBN(dec(1, 13)))
      await token2.mintToken(bamm.address, toBN(dec(1, 4)))      
      
      const lusdQty = dec(105, 7)
      const expectedReturn = await bamm.getReturn(lusdQty, dec(6000, 7), toBN(dec(6000, 7)).add(toBN(dec(2 * 420, 7))), 200)

      // without fee
      await bamm.setParams(200, 0, 0, {from: bammOwner})
      const priceWithoutFee = await bamm.getSwapAmount(lusdQty, token0.address)
      assert.equal(priceWithoutFee.toString(), expectedReturn.mul(toBN(dec(1,12 - 7))).div(toBN(105)).toString())
    })    

    it('test fetch price', async () => {
      await priceFeed0.setPrice(dec(666, 18));
      await priceFeed1.setPrice(dec(333, 18));
      await priceFeed2.setPrice(dec(111, 18));      
      
      assert.equal((await bamm.fetchPrice(token0.address)).toString(), dec(666, 18 - (12 - 7)))
      assert.equal((await bamm.fetchPrice(token1.address)).toString(), dec(333, 18 - (13 - 7)))
      assert.equal((await bamm.fetchPrice(token2.address)).toString(), dec(111, 18 - ( 4 - 7)))
      
      await priceFeed2.setDecimals(2)
      await priceFeed2.setPrice(dec(111, 2));
      assert.equal((await bamm.fetchPrice(token2.address)).toString(), dec(111, 18 - ( 4 - 7)))      


      await priceFeed0.setTimestamp(888)
      assert.equal((await bamm.fetchPrice(token0.address)).toString(), "0")      
    })

    it('test swap 12 decimals', async () => {
      await lusdToken.mintToken(A, toBN(dec(100000, 7)), {from: whale})
      await lusdToken.mintToken(whale, toBN(dec(100000, 7)), {from: whale})      

      await lusdToken.approve(bamm.address, toBN(dec(10000, 7)), { from: A })
      await lusdToken.approve(bamm.address, toBN(dec(10000, 7)), { from: whale })

      await bamm.deposit(toBN(dec(6000, 7)), { from: A } )
      assert.equal(toBN(dec(6000, 7)).toString(), (await lusdToken.balanceOf(bamm.address)).toString())

      // send ETH to bamm, mimics liquidations. total of 420 usd
      await priceFeed0.setPrice(dec(105, 18), {from: bammOwner});
      await priceFeed1.setPrice(dec(90, 18), {from: bammOwner});
      await priceFeed2.setPrice(dec(120, 18), {from: bammOwner});
      
      await token0.mintToken(bamm.address, toBN(dec(2, 12)))
      await token1.mintToken(bamm.address, toBN(dec(1, 13)))
      await token2.mintToken(bamm.address, toBN(dec(1, 4)))

      // with fee
      await bamm.setParams(20, 100, 0, {from: bammOwner})
      const priceWithFee = await bamm.getSwapAmount(dec(105, 7), token0.address)

      await lusdToken.approve(bamm.address, dec(105,7), {from: whale})
      const dest = "0xdEADBEEF00AA81bBCF694bC5c05A397F5E5658D5"

      await assertRevert(bamm.swap(dec(105,7), token0.address, priceWithFee.add(toBN(1)), dest, {from: whale}), 'swap: low return')      
      await bamm.swap(dec(105,7), token0.address, priceWithFee, dest, {from: whale})

      const fees = toBN(dec(105,7)).div(toBN(100))

      // check lusd balance
      assert.equal(toBN(dec(6105, 7)).toString(), (await lusdToken.balanceOf(bamm.address)).add(fees).toString())

      // check eth balance
      assert.equal((await token0.balanceOf(dest)).toString(), priceWithFee.toString())
      assert.equal("1005498373333", priceWithFee.toString())

      // check fees
      assert.equal((await lusdToken.balanceOf(await bamm.feePool())).toString(), fees)
    })

    it('test swap 4 decimals', async () => {
      await lusdToken.mintToken(A, toBN(dec(100000, 7)), {from: whale})
      await lusdToken.mintToken(whale, toBN(dec(100000, 7)), {from: whale})      

      await lusdToken.approve(bamm.address, toBN(dec(10000, 7)), { from: A })
      await lusdToken.approve(bamm.address, toBN(dec(10000, 7)), { from: whale })

      await bamm.deposit(toBN(dec(6000, 7)), { from: A } )
      assert.equal(toBN(dec(6000, 7)).toString(), (await lusdToken.balanceOf(bamm.address)).toString())

      // send ETH to bamm, mimics liquidations. total of 420 usd
      await priceFeed0.setPrice(dec(20, 18), {from: bammOwner});
      await priceFeed1.setPrice(dec(85, 18), {from: bammOwner});
      await priceFeed2.setPrice(dec(105, 18), {from: bammOwner});
      
      await token0.mintToken(bamm.address, toBN(dec(1, 12)))
      await token1.mintToken(bamm.address, toBN(dec(1, 13)))
      await token2.mintToken(bamm.address, toBN(dec(3, 4)))

      // with fee
      await bamm.setParams(20, 100, 0, {from: bammOwner})
      const priceWithFee = await bamm.getSwapAmount(dec(105, 7), token2.address)

      await lusdToken.approve(bamm.address, dec(105,7), {from: whale})
      const dest = "0xdEADBEEF00AA81bBCF694bC5c05A397F5E5658D5"

      await assertRevert(bamm.swap(dec(105,7), token2.address, priceWithFee.add(toBN(1)), dest, {from: whale}), 'swap: low return')      
      await bamm.swap(dec(105,7), token2.address, priceWithFee, dest, {from: whale})

      const fees = toBN(dec(105,7)).div(toBN(100))

      // check lusd balance
      assert.equal(toBN(dec(6105, 7)).toString(), (await lusdToken.balanceOf(bamm.address)).add(fees).toString())

      // check eth balance
      assert.equal((await token2.balanceOf(dest)).toString(), priceWithFee.toString())
      assert.equal("10054", priceWithFee.toString())

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

      // send ETH to bamm, mimics liquidations. total of 420 usd
      await priceFeed0.setPrice(dec(105, 18), {from: bammOwner});
      await priceFeed1.setPrice(dec(90, 18), {from: bammOwner});
      await priceFeed2.setPrice(dec(120, 18), {from: bammOwner});
      
      await token0.mintToken(bamm.address, toBN(dec(2, 12)))
      await token1.mintToken(bamm.address, toBN(dec(1, 13)))
      await token2.mintToken(bamm.address, toBN(dec(1, 4)))

      const ethGains = toBN(dec(420,7))

      const lusdQty = dec(105, 7)
      const expectedReturn200 = await bamm.getReturn(lusdQty, dec(6000, 7), toBN(dec(6000, 7)).add(ethGains.mul(toBN(2))), 200)
      const expectedReturn190 = await bamm.getReturn(lusdQty, dec(6000, 7), toBN(dec(6000, 7)).add(ethGains.mul(toBN(2))), 190)

      assert(expectedReturn200.toString() !== expectedReturn190.toString())

      // without fee
      await bamm.setParams(200, 0, 0, {from: bammOwner})
      const priceWithoutFee = await bamm.getSwapAmount(lusdQty, token0.address)
      assert.equal(priceWithoutFee.toString(), expectedReturn200.mul(toBN(dec(1,12-7))).div(toBN(105)).toString())

      // with fee
      await bamm.setParams(190, 100, 0, {from: bammOwner})
      const priceWithFee = await bamm.getSwapAmount(lusdQty, token0.address)
      assert.equal(priceWithFee.toString(), expectedReturn190.mul(toBN(dec(1,12-7))).div(toBN(105)).toString())
    })    
    
    it('test set params sad path', async () => {
      await assertRevert(bamm.setParams(210, 100, 50, {from: bammOwner}), 'setParams: A too big')
      await assertRevert(bamm.setParams(10, 100, 50, {from: bammOwner}), 'setParams: A too small')
      await assertRevert(bamm.setParams(10, 101, 50, {from: bammOwner}), 'setParams: fee is too big')
      await assertRevert(bamm.setParams(10, 100, 150, {from: bammOwner}), 'setParams: caller fee is too big')      
      await assertRevert(bamm.setParams(20, 100, 50, {from: B}), 'Ownable: caller is not the owner')      
    })

    it('ERC20 test', async () => { // transfer is not supported anymore
      await lusdToken.mintToken(A, toBN(dec(100000, 7)), {from: A})
      await lusdToken.approve(bamm.address, toBN(dec(100000, 7)), { from: A })
      await bamm.deposit(toBN(dec(100000, 7)), {from: A})
      
      assert.equal((await bamm.balanceOf(A)).toString(), dec(1,18), "uncexpected bamm balance")

      // try to send bigger qty than balance
      await assertRevert(bamm.transfer(B, dec(2,18), {from: A}), "SafeMath: subtraction overflow")

      await bamm.transfer(B, dec(4, 17), {from: A})
      assert.equal((await bamm.balanceOf(A)).toString(), dec(6,17))
      assert.equal((await bamm.balanceOf(B)).toString(), dec(4,17))

      await bamm.approve(C, dec(1,17), {from: A})
      assert.equal((await bamm.allowance(A, C)).toString(), dec(1,17), "unexpected allowance")

      await bamm.transferFrom(A, D, dec(4,16), {from: C})
      assert.equal((await bamm.balanceOf(D)).toString(), dec(4,16))
      assert.equal((await bamm.balanceOf(A)).toString(), dec(60 - 4,16))      
      assert.equal((await bamm.allowance(A, C)).toString(), dec(6,16), "unexpected allowance")

      // try to send bigger qty than allowance
      await assertRevert(bamm.transferFrom(A, B, dec(1,17), {from: C}), "SafeMath: subtraction overflow")

      // make sure that balances are as expected
      assert.equal((await bamm.balanceOf(A)).toString(), dec(56,16))
      assert.equal((await bamm.balanceOf(B)).toString(), dec(4,17))
      assert.equal((await bamm.balanceOf(C)).toString(), "0")      
      assert.equal((await bamm.balanceOf(D)).toString(), dec(4,16))

      await bamm.withdraw(dec(56, 16), {from: A})
      await bamm.withdraw(dec(4, 17), {from: B})
      await bamm.withdraw(dec(4, 16), {from: D})

      assert.equal((await lusdToken.balanceOf(A)).toString(), dec(100000 * 56 / 100, 7))
      assert.equal((await lusdToken.balanceOf(B)).toString(), dec(100000 * 4 / 10, 7))
      assert.equal((await lusdToken.balanceOf(D)).toString(), dec(100000 * 4 / 100, 7))            
    })

    it('test remove collateral', async () => {
      await priceFeed0.setPrice(dec(1, 18), {from: bammOwner});
      await priceFeed1.setPrice(dec(2, 18), {from: bammOwner});
      await priceFeed2.setPrice(dec(3, 18), {from: bammOwner});

      await token0.mintToken(bamm.address, dec(1,12))
      await token1.mintToken(bamm.address, dec(1,13))
      await token2.mintToken(bamm.address, dec(1,4))
      
      assert.equal((await bamm.getCollateralValue()).value.toString(), dec(6, 7))
      assert(await bamm.cTokens(cToken0.address))
      assert(await bamm.cTokens(cToken1.address))
      assert(await bamm.cTokens(cToken2.address))
      assert((await bamm.priceAggregators(token0.address)).toString() !== ZERO_ADDRESS)
      assert((await bamm.priceAggregators(token1.address)).toString() !== ZERO_ADDRESS)
      assert((await bamm.priceAggregators(token2.address)).toString() !== ZERO_ADDRESS)      


      await bamm.removeCollateral(cToken1.address, {from: bammOwner})      
      assert.equal((await bamm.getCollateralValue()).value.toString(), dec(4, 7))
      assert(! await bamm.cTokens(cToken1.address))
      assert.equal((await bamm.priceAggregators(token1.address)).toString(), ZERO_ADDRESS)      
      
      await bamm.removeCollateral(cToken0.address, {from: bammOwner})      
      assert.equal((await bamm.getCollateralValue()).value.toString(), dec(3, 7))
      assert(! await bamm.cTokens(cToken0.address))
      assert.equal((await bamm.priceAggregators(token0.address)).toString(), ZERO_ADDRESS)

      await bamm.removeCollateral(cToken2.address, {from: bammOwner})      
      assert.equal((await bamm.getCollateralValue()).value.toString(), "0")
      assert(! await bamm.cTokens(cToken2.address))
      assert.equal((await bamm.priceAggregators(token2.address)).toString(), ZERO_ADDRESS)      
    })



    // TODO:
    // sad paths
    // rari compound code
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