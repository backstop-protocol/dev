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
const BAMM = artifacts.require("HundredBAMM.sol")
const Admin = artifacts.require("Admin")
const MockWithAdmin = artifacts.require("MockWithAdmin")
const BLens = artifacts.require("BLens.sol")
const ChainlinkTestnet = artifacts.require("ChainlinkTestnet.sol")
const FlashswapStub = artifacts.require("FlashswapStub.sol")
const FlashswapHonest = artifacts.require("FlashswapHonest.sol")
const FlashswapMalicious = artifacts.require("FlashswapMalicious.sol")

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

      cETH = await MockCToken.new(ZERO_ADDRESS, true)
      
      priceFeed0 = await ChainlinkTestnet.new()
      priceFeed1 = await ChainlinkTestnet.new()
      priceFeed2 = await ChainlinkTestnet.new()

      bamm = await BAMM.new(cLUSD.address,
                            false,
                            400,
                            feePool,
                            {from: bammOwner})

      await bamm.addCollateral(cToken0.address, priceFeed0.address, {from: bammOwner})
      await bamm.addCollateral(cToken1.address, priceFeed1.address, {from: bammOwner})
      await bamm.addCollateral(cToken2.address, priceFeed2.address, {from: bammOwner})

      bammETH = await BAMM.new(cETH.address, true, 400, feePool, {from: bammOwner})
      await bammETH.addCollateral(cToken0.address, priceFeed0.address, {from: bammOwner})
      await bammETH.addCollateral(cToken1.address, priceFeed1.address, {from: bammOwner})
      await bammETH.addCollateral(cToken2.address, priceFeed2.address, {from: bammOwner})
    })

    it("test hundred extension", async () => {
      const symbol = await bamm.symbol()
      const name = await bamm.name()
      assert.equal(symbol, "bBAMM")
      assert.equal(name, "bBAMM")

      const collateralCount = await bamm.collateralCount()
      assert.equal(collateralCount.toString(), "3")
    })

    it("liquidateBorrow bamm", async () => {
      await bamm.setParams(20, 100, 50, {from: bammOwner})
      const liquidationAmount = toBN(dec(1000, 8))
      const collateralAmount = toBN(dec(3000, 8))
      await mintCLUSD(shmuel, liquidationAmount)
      await cLUSD.approve(bamm.address, liquidationAmount, {from: shmuel})
      await bamm.deposit(liquidationAmount, {from: shmuel})

      await mintCToken(token0, cToken0, yaron, collateralAmount)

      const callerToken0BalanceBefore = toBN(await cToken0.balanceOf(shmuel))

      const expectedCallerFee = collateralAmount.div(toBN(200)) // 0.5%
      await cLUSD.setPrice(toBN(dec(3, 18)))

      await bamm.liquidateBorrow(yaron, liquidationAmount, cToken0.address, {from: shmuel})
      
      const callerToken0BalanceAfter = toBN(await cToken0.balanceOf(shmuel))
      const bammToken0Balance = await cToken0.balanceOf(bamm.address)
      const expectdToken0Balance = collateralAmount.sub(expectedCallerFee)
      assert.equal(expectdToken0Balance.toString(), bammToken0Balance.toString())
      const bammLusdBalance = await cLUSD.balanceOf(bamm.address)
      assert.equal(bammLusdBalance.toString(), "0")
      const callerToken0Delta = callerToken0BalanceAfter.sub(callerToken0BalanceBefore)
      assert.equal(expectedCallerFee.toString(), callerToken0Delta.toString())
    })

    it("liquidateBorrow bammETH", async () => {
      await bammETH.setParams(20, 100, 50, {from: bammOwner})
      const liquidationAmount = toBN(dec(1000, 8))
      const collateralAmount = toBN(dec(3000, 8))
      await cETH.depositEther({from: shmuel, value: liquidationAmount})
      await cETH.approve(bammETH.address, liquidationAmount, {from: shmuel})
      await bammETH.deposit(liquidationAmount, {from: shmuel})

      await mintCToken(token0, cToken0, yaron, collateralAmount)

      const callerToken0BalanceBefore = toBN(await cToken0.balanceOf(shmuel))

      const expectedCallerFee = collateralAmount.div(toBN(200)) // 0.5%
      await cETH.setPrice(toBN(dec(3, 18)))

      await bammETH.liquidateBorrow(yaron, liquidationAmount, cToken0.address, {from: shmuel})
      
      const callerToken0BalanceAfter = toBN(await cToken0.balanceOf(shmuel))
      const bammToken0Balance = await cToken0.balanceOf(bammETH.address)
      const expectdToken0Balance = collateralAmount.sub(expectedCallerFee)
      assert.equal(expectdToken0Balance.toString(), bammToken0Balance.toString())
      const bammLusdBalance = await cLUSD.balanceOf(bammETH.address)
      assert.equal(bammLusdBalance.toString(), "0")
      const callerToken0Delta = callerToken0BalanceAfter.sub(callerToken0BalanceBefore)
      assert.equal(expectedCallerFee.toString(), callerToken0Delta.toString())
    })    

    it("liquidateLUSD with LUSD", async () => {
      await bamm.setParams(20, 100, 50, {from: bammOwner})
      const liquidationAmount = toBN(dec(1000, 8))
      const collateralAmount = toBN(dec(1100, 8))
      await mintCLUSD(shmuel, liquidationAmount)
      await cLUSD.approve(bamm.address, liquidationAmount, {from: shmuel})
      await bamm.deposit(liquidationAmount, {from: shmuel})

      await mintCLUSD(yaron, collateralAmount)

      await cLUSD.setPrice(toBN(dec(11, 17))) // 0.1 liquidation penelty
      // in LUSD <> LUSD the fee is from the liquidation penelty
      const expectedCallerFee = liquidationAmount.div(toBN(2000)) // 0.5% from 1/10

      const shmuelLusdBefore = await cLUSD.balanceOf(shmuel)
      await bamm.liquidateBorrow(yaron, liquidationAmount, cLUSD.address, {from: shmuel})
      const shmuelLusdAfter = await cLUSD.balanceOf(shmuel)      

      assert.equal(expectedCallerFee.toString(), shmuelLusdAfter.sub(shmuelLusdBefore).toString())

      const bammLusdBalance = await cLUSD.balanceOf(bamm.address)
      const expectdLusdBalance = collateralAmount.sub(expectedCallerFee)
      assert.equal(expectdLusdBalance.toString(), bammLusdBalance.toString())
    })    
    
    it("canLiquidate", async ()=> {
      const liquidationAmount = toBN(dec(1000, 8))

      await mintCLUSD(shmuel, liquidationAmount)
      await cLUSD.approve(bamm.address, liquidationAmount, {from: shmuel})
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

      // cash exceeded
      await cLUSD.borrow(1, {from: alice})

      canLiquidate = await bamm.canLiquidate(cLUSD.address, cToken2.address, liquidationAmount)
      assert.equal(canLiquidate, false)      
    })

    // --- provideToSP() ---
    // increases recorded LUSD at Stability Pool

    async function mintCLUSD(user, amount) {
      await lusdToken.mintToken(user, amount, {from: user})
      lusdToken.approve(cLUSD.address, amount, {from: user})
      await cLUSD.depositToken(amount, {from: user})
    }

    async function mintCToken(underlying, cToken, user, amount) {
      await underlying.mintToken(alice, amount, {from: alice})
      underlying.approve(cToken.address, amount, {from: alice})

      const balanceBefore = await cToken.balanceOf(alice)      
      await cToken.depositToken(amount, {from: alice})
      const balanceAfter = await cToken.balanceOf(alice)
      
      const delta = toBN(balanceAfter).sub(toBN(balanceBefore))

      await cToken.transfer(user, delta, {from: alice})
    }    

    it("deposit(): increases the Stability Pool LUSD balance", async () => {
      // --- SETUP --- Give Alice a least 200
      await mintCLUSD(alice, toBN(200))

      // --- TEST ---
      await cLUSD.approve(bamm.address, toBN(200), { from: alice })
      await bamm.deposit(toBN(200), { from: alice })

      // check LUSD balances after
      const bamm_LUSD_After = await cLUSD.balanceOf(bamm.address)
      assert.equal(bamm_LUSD_After, 200)
    })

    // --- provideToSP() ---
    // increases recorded LUSD at Stability Pool
    it("deposit(): two users deposit, check their share", async () => {
      // --- SETUP --- Give Alice and whale at least 200
      await mintCLUSD(alice, toBN(200))
      await mintCLUSD(whale, toBN(200))

      // --- TEST ---
      await cLUSD.approve(bamm.address, toBN(200), { from: alice })
      await cLUSD.approve(bamm.address, toBN(200), { from: whale })      
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
      await mintCLUSD(alice, toBN(200))
      await mintCLUSD(whale, toBN(200))      

      // --- TEST ---
      await cLUSD.approve(bamm.address, toBN(200), { from: alice })
      await cLUSD.approve(bamm.address, toBN(100), { from: whale })      
      await bamm.deposit(toBN(200), { from: alice })
      await bamm.deposit(toBN(100), { from: whale })      

      // check LUSD balances after1
      const whaleShare = await bamm.balanceOf(whale)
      const aliceShare = await bamm.balanceOf(alice)

      assert.equal(whaleShare.mul(toBN(2)).toString(), aliceShare.toString())

      const whaleBalanceBefore = await cLUSD.balanceOf(whale)
      const shareToWithdraw = whaleShare.div(toBN(2));
      await bamm.withdraw(shareToWithdraw, { from: whale });

      const newWhaleShare = await bamm.balanceOf(whale)
      assert.equal(newWhaleShare.mul(toBN(2)).toString(), whaleShare.toString())

      const whaleBalanceAfter = await cLUSD.balanceOf(whale)
      assert.equal(whaleBalanceAfter.sub(whaleBalanceBefore).toString(), 50)      
    })

    it('test share with collateral', async () => {
      // --- SETUP ---
      await mintCLUSD(whale, toBN(dec(100000, 8)))
      await mintCLUSD(A, toBN(dec(100000, 8)))
      await mintCLUSD(B, toBN(dec(100000, 8)))              
            
      const whaleLUSD = await cLUSD.balanceOf(whale)
      await cLUSD.approve(bamm.address, whaleLUSD, { from: whale })
      await cLUSD.approve(bamm.address, toBN(dec(6000, 8)), { from: A })
      await bamm.deposit(toBN(dec(6000, 8)), { from: A } )

      // send $6k collateral to bamm, mimics liquidations
      await mintCToken(token0, cToken0, bamm.address, toBN(dec(1000, 8))) // $3k
      await mintCToken(token1, cToken1, bamm.address, toBN(dec(200, 8))) // $1k
      await mintCToken(token2, cToken2, bamm.address, toBN(dec(500, 8))) // $2k

      // price set so that total collateral is $6k
      await priceFeed0.setPrice(dec(3, 18));
      await priceFeed1.setPrice(dec(5, 18));
      await priceFeed2.setPrice(dec(4, 18));


      assert.equal(toBN(dec(6000, 8)).toString(), (await cLUSD.balanceOf(bamm.address)).toString())
      const collateralValue = await bamm.getCollateralValue()
      assert.equal((collateralValue.value).toString(), toBN(dec(6000, 8)).toString(), "unexpected collateral value")

      const totalUsd = toBN(dec(6000 * 2, 8))

      await cLUSD.approve(bamm.address, totalUsd, { from: B })       
      await bamm.deposit(totalUsd, { from: B } )      

      assert.equal((await bamm.balanceOf(A)).toString(), (await bamm.balanceOf(B)).toString())

      const token0BalBefore = toBN(await cToken0.balanceOf(A))
      const token1BalBefore = toBN(await cToken1.balanceOf(A))
      const token2BalBefore = toBN(await cToken2.balanceOf(A))

      const LUSDBefore = await cLUSD.balanceOf(A)

      await bamm.withdraw(await bamm.balanceOf(A), {from: A})

      const LUSDAfter = await cLUSD.balanceOf(A)

      const token0BalAfter = toBN(await cToken0.balanceOf(A))
      const token1BalAfter = toBN(await cToken1.balanceOf(A))
      const token2BalAfter = toBN(await cToken2.balanceOf(A))


      // LUSD
      assert.equal(toBN(dec((6000 + 6000 * 2) / 2, 8)).toString(), LUSDAfter.sub(LUSDBefore).toString())

      // token 0-2
      assert.equal(toBN(dec(500, 8)).toString(), token0BalAfter.sub(token0BalBefore).toString())
      assert.equal(toBN(dec(100, 8)).toString(), token1BalAfter.sub(token1BalBefore).toString())
      assert.equal(toBN(dec(250, 8)).toString(), token2BalAfter.sub(token2BalBefore).toString())
    })

    it('test efficient withdraw', async () => {
      // --- SETUP ---
      await mintCLUSD(A, toBN(dec(100000, 8)))
            
      await cLUSD.approve(bamm.address, toBN(dec(6000, 8)), { from: A })
      await bamm.deposit(toBN(dec(6000, 8)), { from: A } )

      // send $6k collateral to bamm, mimics liquidations
      await mintCToken(token0, cToken0, bamm.address, toBN(dec(1000, 8))) // $3k
      await mintCToken(token1, cToken1, bamm.address, toBN(dec(200, 8))) // $1k
      await mintCToken(token2, cToken2, bamm.address, toBN(dec(500, 8))) // $2k

      // price set so that total collateral is $6k
      await priceFeed0.setPrice(dec(3, 18));
      await priceFeed1.setPrice(dec(5, 18));
      await priceFeed2.setPrice(dec(4, 18));


      assert.equal(toBN(dec(6000, 8)).toString(), (await cLUSD.balanceOf(bamm.address)).toString())
      const collateralValue = await bamm.getCollateralValue()
      assert(collateralValue.succ, "get collateral value failed")      
      assert.equal((collateralValue.value).toString(), toBN(dec(6000, 8)).toString(), "unexpected collateral value")

      const to = bob

      // withdraw half of shares without collateral
      await bamm.efficientWithdraw(dec(5,17), to, false, dec(3000, 8), {from: A})
      
      // lusd balance
      assert.equal((await cLUSD.balanceOf(to)).toString(), dec(3000, 8))
      // collateral value should not change
      assert.equal(collateralValue.toString(), (await bamm.getCollateralValue()).toString())
      // ctoken value
      assert.equal((await cToken0.balanceOf(to)).toString(), "0")      
      assert.equal((await cToken1.balanceOf(to)).toString(), "0")
      assert.equal((await cToken2.balanceOf(to)).toString(), "0")

      // withdraw with min amount too high
      assertRevert(bamm.efficientWithdraw(dec(5,17), to, false, dec(3001, 8), {from: A}), "efficientWithdraw: insufficient lusd amount")

      // withdraw with collateral
      await bamm.efficientWithdraw(dec(5,17), to, true, dec(3000, 8), {from: A})
      // lusd balance
      assert.equal((await cLUSD.balanceOf(to)).toString(), dec(6000, 8))
      // collateral value should be 0
      const collateralValue2 = await bamm.getCollateralValue()
      assert(collateralValue2.succ, "get collateral value failed")
      assert.equal("0", (collateralValue2.value).toString())
      // ctoken value
      assert.equal((await cToken0.balanceOf(to)).toString(), dec(1000, 8))      
      assert.equal((await cToken1.balanceOf(to)).toString(), dec(200, 8))
      assert.equal((await cToken2.balanceOf(to)).toString(), dec(500, 8))      
    })    

    it('price exceed max dicount and/or collateral balance', async () => {
      await mintCLUSD(A, toBN(dec(100000, 8)))
      await cLUSD.approve(bamm.address, toBN(dec(10000, 8)), { from: A })
      await bamm.deposit(toBN(dec(6000, 8)), { from: A } )

      // price drops: defaulter's Troves fall below MCR, whale doesn't
      await priceFeed0.setPrice(dec(105, 18));

      // 4k liquidations
      assert.equal(toBN(dec(6000, 8)).toString(), (await cLUSD.balanceOf(bamm.address)).toString())

      // send ETH to bamm, mimics liquidations
      const ethGains = web3.utils.toBN("39799999999999")
      await mintCToken(token0, cToken0, bamm.address, ethGains) 

      // without fee
      await bamm.setParams(20, 0, 0, {from: bammOwner})
      const price = await bamm.getSwapAmount(dec(105, 8), cToken0.address)
      assert.equal(price.toString(), dec(104, 6).toString())

      // with fee - should be the same, as fee is on the lusd
      await bamm.setParams(20, 100, 0, {from: bammOwner})
      const priceWithFee = await bamm.getSwapAmount(dec(105, 8), cToken0.address)
      assert.equal(price.toString(), dec(104, 6).toString())

      // without fee
      await bamm.setParams(20, 0, 0, {from: bammOwner})
      const priceDepleted = await bamm.getSwapAmount(dec(1050000000000000, 8), cToken0.address)
      assert.equal(priceDepleted.toString(), ethGains.toString())      

      // with fee - should be the same
      await bamm.setParams(20, 100, 0, {from: bammOwner})
      const priceDepletedWithFee = await bamm.getSwapAmount(dec(1050000000000000, 8), cToken0.address)
      assert.equal(priceDepletedWithFee.toString(), ethGains.toString())
    })

    it('test getSwapAmount', async () => {
      await mintCLUSD(A, toBN(dec(100000, 8)))
      await cLUSD.approve(bamm.address, toBN(dec(10000, 8)), { from: A })
      await bamm.deposit(toBN(dec(6000, 8)), { from: A } )

      await priceFeed0.setPrice(dec(105, 18), {from: bammOwner});
      await priceFeed1.setPrice(dec(90, 18), {from: bammOwner});
      await priceFeed2.setPrice(dec(120, 18), {from: bammOwner});      

      assert.equal(toBN(dec(6000, 8)).toString(), (await cLUSD.balanceOf(bamm.address)).toString())

      // send ETH to bamm, mimics liquidations. total of 420 usd
      await mintCToken(token0, cToken0, bamm.address, toBN(dec(2, 8)))
      await mintCToken(token1, cToken1, bamm.address, toBN(dec(1, 8)))
      await mintCToken(token2, cToken2, bamm.address, toBN(dec(1, 8)))
      
      /*
      await token0.mintToken(bamm.address, toBN(dec(2, 12)))
      await token1.mintToken(bamm.address, toBN(dec(1, 13)))
      await token2.mintToken(bamm.address, toBN(dec(1, 4)))      
      */

      const lusdQty = dec(105, 8)
      const expectedReturn = await bamm.getReturn(lusdQty, dec(6000, 8), toBN(dec(6000, 8)).add(toBN(dec(2 * 420, 8))), 200)

      // without fee
      await bamm.setParams(200, 0, 0, {from: bammOwner})
      const priceWithoutFee = await bamm.getSwapAmount(lusdQty, cToken0.address)
      assert.equal(priceWithoutFee.toString(), expectedReturn.mul(toBN(dec(1,0))).div(toBN(105)).toString())
    })    

    it('test fetch price', async () => {
      await priceFeed0.setPrice(dec(666, 18));
      await priceFeed1.setPrice(dec(333, 18));
      await priceFeed2.setPrice(dec(111, 18));      
      
      assert.equal((await bamm.fetchPrice(cToken0.address)).toString(), dec(666, 18))
      assert.equal((await bamm.fetchPrice(cToken1.address)).toString(), dec(333, 18))
      assert.equal((await bamm.fetchPrice(cToken2.address)).toString(), dec(111, 18))
      
      await priceFeed0.setTimestamp(888)
      assert.equal((await bamm.fetchPrice(cToken0.address)).toString(), "0")      
    })

    it('test swap', async () => {
      await mintCLUSD(A, toBN(dec(100000, 8)))
      await mintCLUSD(whale, toBN(dec(100000, 8)))      

      await cLUSD.approve(bamm.address, toBN(dec(10000, 8)), { from: A })
      await cLUSD.approve(bamm.address, toBN(dec(10000, 8)), { from: whale })

      await bamm.deposit(toBN(dec(6000, 8)), { from: A } )
      assert.equal(toBN(dec(6000, 8)).toString(), (await cLUSD.balanceOf(bamm.address)).toString())

      // send ETH to bamm, mimics liquidations. total of 420 usd
      await priceFeed0.setPrice(dec(105, 18), {from: bammOwner});
      await priceFeed1.setPrice(dec(90, 18), {from: bammOwner});
      await priceFeed2.setPrice(dec(120, 18), {from: bammOwner});

      await mintCToken(token0, cToken0, bamm.address, toBN(dec(2, 8)))
      await mintCToken(token1, cToken1, bamm.address, toBN(dec(1, 8)))
      await mintCToken(token2, cToken2, bamm.address, toBN(dec(1, 8)))

      // with fee
      await bamm.setParams(20, 100, 0, {from: bammOwner})
      const priceWithFee = await bamm.getSwapAmount(dec(105, 8), cToken0.address)

      await cLUSD.approve(bamm.address, dec(105,8), {from: whale})
      const dest = "0xdEADBEEF00AA81bBCF694bC5c05A397F5E5658D5"

      await assertRevert(bamm.swap(dec(105,8), cToken0.address, priceWithFee.add(toBN(1)), dest, "0x", {from: whale}), 'swap: low return')      
      await bamm.swap(dec(105,8), cToken0.address, priceWithFee, dest, "0x", {from: whale})

      const fees = toBN(dec(105,8)).div(toBN(100))

      // check lusd balance
      assert.equal(toBN(dec(6105, 8)).toString(), (await cLUSD.balanceOf(bamm.address)).add(fees).toString())

      // check eth balance
      assert.equal((await cToken0.balanceOf(dest)).toString(), priceWithFee.toString())
      assert.equal("100549837", priceWithFee.toString())

      // check fees
      assert.equal((await cLUSD.balanceOf(await bamm.feePool())).toString(), fees)
    })

    it('test flash swap stub', async () => {
      await mintCLUSD(A, toBN(dec(100000, 8)))
      await mintCLUSD(whale, toBN(dec(100000, 8)))      

      await cLUSD.approve(bamm.address, toBN(dec(10000, 8)), { from: A })
      await cLUSD.approve(bamm.address, toBN(dec(10000, 8)), { from: whale })

      await bamm.deposit(toBN(dec(6000, 8)), { from: A } )
      assert.equal(toBN(dec(6000, 8)).toString(), (await cLUSD.balanceOf(bamm.address)).toString())

      // send ETH to bamm, mimics liquidations. total of 420 usd
      await priceFeed0.setPrice(dec(105, 18), {from: bammOwner});
      await priceFeed1.setPrice(dec(90, 18), {from: bammOwner});
      await priceFeed2.setPrice(dec(120, 18), {from: bammOwner});

      await mintCToken(token0, cToken0, bamm.address, toBN(dec(2, 8)))
      await mintCToken(token1, cToken1, bamm.address, toBN(dec(1, 8)))
      await mintCToken(token2, cToken2, bamm.address, toBN(dec(1, 8)))

      // with fee
      await bamm.setParams(20, 100, 0, {from: bammOwner})
      const priceWithFee = await bamm.getSwapAmount(dec(105, 8), cToken0.address)

      await cLUSD.approve(bamm.address, dec(105,8), {from: whale})
      const flashswapStub = await FlashswapStub.new()      
      const dest = flashswapStub.address
      
      await bamm.swap(dec(105,8), cToken0.address, priceWithFee, dest, "0x1234", {from: whale})

      // check stub
      assert.equal((await flashswapStub.initiator()).toString(), whale.toString())
      assert.equal((await flashswapStub.lusdAmount()).toString(), dec(105, 8).toString())
      assert.equal((await flashswapStub.returnAmount()).toString(), priceWithFee.toString())
      assert.equal((await flashswapStub.data()).toString(), "0x1234")      

      // check eth balance
      assert.equal((await cToken0.balanceOf(dest)).toString(), priceWithFee.toString())
    })    

    it('test flash swap honest', async () => {
      await mintCLUSD(A, toBN(dec(100000, 8)))
      await mintCLUSD(whale, toBN(dec(100000, 8)))      

      await cLUSD.approve(bamm.address, toBN(dec(10000, 8)), { from: A })
      await cLUSD.approve(bamm.address, toBN(dec(10000, 8)), { from: whale })

      await bamm.deposit(toBN(dec(6000, 8)), { from: A } )
      assert.equal(toBN(dec(6000, 8)).toString(), (await cLUSD.balanceOf(bamm.address)).toString())

      // send ETH to bamm, mimics liquidations. total of 420 usd
      await priceFeed0.setPrice(dec(105, 18), {from: bammOwner});
      await priceFeed1.setPrice(dec(90, 18), {from: bammOwner});
      await priceFeed2.setPrice(dec(120, 18), {from: bammOwner});

      await mintCToken(token0, cToken0, bamm.address, toBN(dec(2, 8)))
      await mintCToken(token1, cToken1, bamm.address, toBN(dec(1, 8)))
      await mintCToken(token2, cToken2, bamm.address, toBN(dec(1, 8)))

      // with fee
      await bamm.setParams(20, 100, 0, {from: bammOwner})
      const priceWithFee = await bamm.getSwapAmount(dec(105, 8), cToken0.address)

      await cLUSD.approve(bamm.address, dec(105,8), {from: whale})
      const flashswapHonest = await FlashswapHonest.new(bamm.address, bob)      
      const dest = flashswapHonest.address

      // send lusd to flash swap so it can send it to bob
      await cLUSD.transfer(dest, dec(105, 8), {from: whale})
      // give allowance from bob to bamm so it could pay for flash loan
      await cLUSD.approve(bamm.address, dec(105, 8), {from: bob})
      
      await bamm.swap(dec(105,8), cToken0.address, priceWithFee, dest, "0x1234", {from: bob})

      // check eth balance
      assert.equal((await cToken0.balanceOf(dest)).toString(), priceWithFee.toString())
    })

    it('test flash swap without repay', async () => {
      await mintCLUSD(A, toBN(dec(100000, 8)))
      await mintCLUSD(whale, toBN(dec(100000, 8)))      

      await cLUSD.approve(bamm.address, toBN(dec(10000, 8)), { from: A })
      await cLUSD.approve(bamm.address, toBN(dec(10000, 8)), { from: whale })

      await bamm.deposit(toBN(dec(6000, 8)), { from: A } )
      assert.equal(toBN(dec(6000, 8)).toString(), (await cLUSD.balanceOf(bamm.address)).toString())

      // send ETH to bamm, mimics liquidations. total of 420 usd
      await priceFeed0.setPrice(dec(105, 18), {from: bammOwner});
      await priceFeed1.setPrice(dec(90, 18), {from: bammOwner});
      await priceFeed2.setPrice(dec(120, 18), {from: bammOwner});

      await mintCToken(token0, cToken0, bamm.address, toBN(dec(2, 8)))
      await mintCToken(token1, cToken1, bamm.address, toBN(dec(1, 8)))
      await mintCToken(token2, cToken2, bamm.address, toBN(dec(1, 8)))

      // with fee
      await bamm.setParams(20, 100, 0, {from: bammOwner})
      const priceWithFee = await bamm.getSwapAmount(dec(105, 8), cToken0.address)

      await cLUSD.approve(bamm.address, dec(105,8), {from: whale})
      const flashswapHonest = await FlashswapHonest.new(bamm.address, carol) // send lusd to carol and not bob     
      const dest = flashswapHonest.address

      // send lusd to flash swap so it can send it to bob
      await cLUSD.transfer(dest, dec(105, 8), {from: whale})
      // give allowance from bob to bamm so it could pay for flash loan
      await cLUSD.approve(bamm.address, dec(105, 8), {from: bob})
      
      await assertRevert(bamm.swap(dec(105,8), cToken0.address, priceWithFee, dest, "0x1234", {from: bob}), "transferFrom: insufficient balance")
    })    
    
    it('test flash swap malicious', async () => {
      await mintCLUSD(A, toBN(dec(100000, 8)))
      await mintCLUSD(whale, toBN(dec(100000, 8)))      

      await cLUSD.approve(bamm.address, toBN(dec(10000, 8)), { from: A })
      await cLUSD.approve(bamm.address, toBN(dec(10000, 8)), { from: whale })

      await bamm.deposit(toBN(dec(6000, 8)), { from: A } )
      assert.equal(toBN(dec(6000, 8)).toString(), (await cLUSD.balanceOf(bamm.address)).toString())

      // send ETH to bamm, mimics liquidations. total of 420 usd
      await priceFeed0.setPrice(dec(105, 18), {from: bammOwner});
      await priceFeed1.setPrice(dec(90, 18), {from: bammOwner});
      await priceFeed2.setPrice(dec(120, 18), {from: bammOwner});

      await mintCToken(token0, cToken0, bamm.address, toBN(dec(2, 8)))
      await mintCToken(token1, cToken1, bamm.address, toBN(dec(1, 8)))
      await mintCToken(token2, cToken2, bamm.address, toBN(dec(1, 8)))

      // with fee
      await bamm.setParams(20, 100, 0, {from: bammOwner})
      const priceWithFee = await bamm.getSwapAmount(dec(105, 8), cToken0.address)

      await cLUSD.approve(bamm.address, dec(105,8), {from: whale})
      const flashswapMalicious = await FlashswapMalicious.new(bamm.address)      
      const dest = flashswapMalicious.address

      const fakeBAMM = await BAMM.at(flashswapMalicious.address)

      // set data to deposit
      await fakeBAMM.deposit(100)
      //console.log(await flashswapMalicious.data())
      await assertRevert(bamm.swap(dec(105,8), cToken0.address, priceWithFee, dest, "0x1234", {from: bob}), "ReentrancyGuard: reentrant call")

      // set data to withdraw
      await fakeBAMM.withdraw(100)
      //console.log(await flashswapMalicious.data())
      await assertRevert(bamm.swap(dec(105,8), cToken0.address, priceWithFee, dest, "0x1234", {from: bob}), "ReentrancyGuard: reentrant call")

      // set data to efficient withdraw
      await fakeBAMM.efficientWithdraw(100, bob, true, 101)
      //console.log(await flashswapMalicious.data())
      await assertRevert(bamm.swap(dec(105,8), cToken0.address, priceWithFee, dest, "0x1234", {from: bob}), "ReentrancyGuard: reentrant call")

      // set data to swap
      await fakeBAMM.swap(dec(105,8), cToken0.address, priceWithFee, dest, "0x1234")
      //console.log(await flashswapMalicious.data())
      await assertRevert(bamm.swap(dec(105,8), cToken0.address, priceWithFee, dest, "0x1234", {from: bob}), "ReentrancyGuard: reentrant call")

      // set data to swap
      await fakeBAMM.liquidateBorrow(bob, 7, cToken0.address)
      //console.log(await flashswapMalicious.data())
      await assertRevert(bamm.swap(dec(105,8), cToken0.address, priceWithFee, dest, "0x1234", {from: bob}), "ReentrancyGuard: reentrant call")      
    })    

    it('test set params happy path', async () => {
      // --- SETUP ---
      await mintCLUSD(A, toBN(dec(100000, 8)))
      await mintCLUSD(whale, toBN(dec(100000, 8)))       

      await cLUSD.approve(bamm.address, toBN(dec(10000, 8)), { from: A })
      await cLUSD.approve(bamm.address, toBN(dec(10000, 8)), { from: whale })

      await bamm.deposit(toBN(dec(6000, 8)), { from: A } )

      // send ETH to bamm, mimics liquidations. total of 420 usd
      await priceFeed0.setPrice(dec(105, 18), {from: bammOwner});
      await priceFeed1.setPrice(dec(90, 18), {from: bammOwner});
      await priceFeed2.setPrice(dec(120, 18), {from: bammOwner});
      
      await mintCToken(token0, cToken0, bamm.address, toBN(dec(2, 8)))
      await mintCToken(token1, cToken1, bamm.address, toBN(dec(1, 8)))
      await mintCToken(token2, cToken2, bamm.address, toBN(dec(1, 8)))

      const ethGains = toBN(dec(420,8))

      const lusdQty = dec(105, 8)
      const expectedReturn200 = await bamm.getReturn(lusdQty, dec(6000, 8), toBN(dec(6000, 8)).add(ethGains.mul(toBN(2))), 200)
      const expectedReturn190 = await bamm.getReturn(lusdQty, dec(6000, 8), toBN(dec(6000, 8)).add(ethGains.mul(toBN(2))), 190)

      assert(expectedReturn200.toString() !== expectedReturn190.toString())

      // without fee
      await bamm.setParams(200, 0, 0, {from: bammOwner})
      const priceWithoutFee = await bamm.getSwapAmount(lusdQty, cToken0.address)
      assert.equal(priceWithoutFee.toString(), expectedReturn200.mul(toBN(dec(1,0))).div(toBN(105)).toString())

      // with fee
      await bamm.setParams(190, 100, 0, {from: bammOwner})
      const priceWithFee = await bamm.getSwapAmount(lusdQty, cToken0.address)
      assert.equal(priceWithFee.toString(), expectedReturn190.mul(toBN(dec(1,0))).div(toBN(105)).toString())
    })    
    
    it('test set params sad path', async () => {
      await assertRevert(bamm.setParams(210, 100, 50, {from: bammOwner}), 'setParams: A too big')
      await assertRevert(bamm.setParams(10, 100, 50, {from: bammOwner}), 'setParams: A too small')
      await assertRevert(bamm.setParams(10, 101, 50, {from: bammOwner}), 'setParams: fee is too big')
      await assertRevert(bamm.setParams(10, 100, 150, {from: bammOwner}), 'setParams: caller fee is too big')      
      await assertRevert(bamm.setParams(20, 100, 50, {from: B}), 'Ownable: caller is not the owner')      
    })

    it('ERC20 test', async () => { // transfer is not supported anymore
      await mintCLUSD(A, toBN(dec(100000, 8)))
      await cLUSD.approve(bamm.address, toBN(dec(100000, 8)), { from: A })
      await bamm.deposit(toBN(dec(100000, 8)), {from: A})
      
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

      assert.equal((await cLUSD.balanceOf(A)).toString(), dec(100000 * 56 / 100, 8))
      assert.equal((await cLUSD.balanceOf(B)).toString(), dec(100000 * 4 / 10, 8))
      assert.equal((await cLUSD.balanceOf(D)).toString(), dec(100000 * 4 / 100, 8))            
    })

    it('test remove collateral', async () => {
      await priceFeed0.setPrice(dec(1, 18), {from: bammOwner});
      await priceFeed1.setPrice(dec(2, 18), {from: bammOwner});
      await priceFeed2.setPrice(dec(3, 18), {from: bammOwner});

      await mintCToken(token0, cToken0, bamm.address, toBN(dec(1, 8)))
      await mintCToken(token1, cToken1, bamm.address, toBN(dec(1, 8)))
      await mintCToken(token2, cToken2, bamm.address, toBN(dec(1, 8)))
      
      assert.equal((await bamm.getCollateralValue()).value.toString(), dec(6, 8))
      assert(await bamm.cTokens(cToken0.address))
      assert(await bamm.cTokens(cToken1.address))
      assert(await bamm.cTokens(cToken2.address))
      assert((await bamm.priceAggregators(cToken0.address)).toString() !== ZERO_ADDRESS)
      assert((await bamm.priceAggregators(cToken1.address)).toString() !== ZERO_ADDRESS)
      assert((await bamm.priceAggregators(cToken2.address)).toString() !== ZERO_ADDRESS)      


      await bamm.removeCollateral(cToken1.address, {from: bammOwner})      
      assert.equal((await bamm.getCollateralValue()).value.toString(), dec(4, 8))
      assert(! await bamm.cTokens(cToken1.address))
      assert.equal((await bamm.priceAggregators(cToken1.address)).toString(), ZERO_ADDRESS)      
      
      await bamm.removeCollateral(cToken0.address, {from: bammOwner})      
      assert.equal((await bamm.getCollateralValue()).value.toString(), dec(3, 8))
      assert(! await bamm.cTokens(cToken0.address))
      assert.equal((await bamm.priceAggregators(cToken0.address)).toString(), ZERO_ADDRESS)

      await bamm.removeCollateral(cToken2.address, {from: bammOwner})      
      assert.equal((await bamm.getCollateralValue()).value.toString(), "0")
      assert(! await bamm.cTokens(cToken2.address))
      assert.equal((await bamm.priceAggregators(cToken2.address)).toString(), ZERO_ADDRESS)      
    })

    it('test add collateral sad paths', async () => {
      // try to add lusd collateral
      await assertRevert(bamm.addCollateral(cLUSD.address, priceFeed0.address, {from: bammOwner}), "addCollateral: LUSD cannot be collateral")

      // try to add a token with null price feed
      const newToken = await MockToken.new(18)
      const newCToken = await MockCToken.new(newToken.address, false)      
      await assertRevert(bamm.addCollateral(newCToken.address, ZERO_ADDRESS, {from: bammOwner}), "addCollateral: invalid feed")

      // try to add existng collateral
      await assertRevert(bamm.addCollateral(cToken0.address, priceFeed0.address, {from: bammOwner}), "addCollateral: collateral listed")
      
      // try to add as non owner
      await assertRevert(bamm.addCollateral(newCToken.address, priceFeed0.address, {from: shmuel}), "Ownable: caller is not the owner")      
    })

    it('test get collateral value sad paths', async () => {
      await priceFeed0.setPrice(dec(1, 18), {from: bammOwner});
      await priceFeed1.setPrice(dec(2, 18), {from: bammOwner});
      await priceFeed2.setPrice(dec(3, 18), {from: bammOwner});

      await mintCToken(token0, cToken0, bamm.address, toBN(dec(1, 8)))
      await mintCToken(token1, cToken1, bamm.address, toBN(dec(1, 8)))
      await mintCToken(token2, cToken2, bamm.address, toBN(dec(1, 8)))

      assert((await bamm.getCollateralValue()).succ, "getCollateralValue should not fail")

      // nullify price feed 1
      await priceFeed1.setTimestamp(888) // now price expired

      assert(! (await bamm.getCollateralValue()).succ, "getCollateralValue should fail")
    })

    it('test deposit when chainlink is down', async () => {
      await priceFeed0.setPrice(dec(1, 18), {from: bammOwner});
      await priceFeed1.setPrice(dec(2, 18), {from: bammOwner});
      await priceFeed2.setPrice(dec(3, 18), {from: bammOwner});

      await mintCToken(token0, cToken0, bamm.address, toBN(dec(1, 8)))
      await mintCToken(token1, cToken1, bamm.address, toBN(dec(1, 8)))
      await mintCToken(token2, cToken2, bamm.address, toBN(dec(1, 8)))

      await mintCLUSD(A, toBN(dec(100000, 8)))
      await cLUSD.approve(bamm.address, toBN(dec(10000, 8)), { from: A })

      // nullify price feed 1
      await priceFeed1.setTimestamp(888) // now price expired

      await assertRevert(bamm.deposit(toBN(dec(6000, 8)), { from: A } ), "deposit: chainlink is down")
    })

    it('swap sad paths', async () => {
      await priceFeed0.setPrice(dec(1, 18), {from: bammOwner});
      await priceFeed1.setPrice(dec(2, 18), {from: bammOwner});
      await priceFeed2.setPrice(dec(3, 18), {from: bammOwner});

      await mintCToken(token0, cToken0, bamm.address, toBN(dec(1, 8)))
      await mintCToken(token1, cToken1, bamm.address, toBN(dec(1, 8)))
      await mintCToken(token2, cToken2, bamm.address, toBN(dec(1, 8)))

      await mintCLUSD(A, toBN(dec(100000, 8)))
      await cLUSD.approve(bamm.address, toBN(dec(10000, 8)), { from: A })

      // call getSwapAmount and get non 0 value
      let price = await bamm.getSwapAmount(dec(1, 8), cToken1.address)
      assert(price.gt(toBN(0)), "expecting price > 0, and got " + price.toString())

      // nullify price feed 1
      await priceFeed1.setTimestamp(888) // now price expired

      // call getSwapAmount and get non 0 value
      price = await bamm.getSwapAmount(dec(1, 8), cToken1.address)
      assert.equal(price.toString(), "0")

      await assertRevert(bamm.swap(1, cLUSD.address, 0, ZERO_ADDRESS, "0x", { from: A } ), "swap: unsupported")
    })

    it('liquidateBorrow sad path', async () => {
      const newCToken = await MockCToken.new(token0.address, false)
      await assertRevert(bamm.liquidateBorrow(shmuel, 1, newCToken.address, { from: A } ), "liquidateBorrow: invalid collateral")
    })

    it('with admin', async () => {
      const withAdmin = await MockWithAdmin.new()
      await withAdmin.setAdmin(shmuel)
      const adminContract = await Admin.new(withAdmin.address, bamm.address, {from: A})

      await bamm.transferOwnership(adminContract.address, {from: bammOwner})

      // test set params
      await adminContract.setParams(25, 66, 77, {from: A})
      assert.equal((await bamm.A()).toString(), "25")
      assert.equal((await bamm.fee()).toString(), "66")
      assert.equal((await bamm.callerFee()).toString(), "77")
      
      // test set params not from owner
      await assertRevert(adminContract.setParams(25, 66, 77, {from: shmuel}), "Ownable: caller is not the owner")

      // test new admin not from compoud admin
      await assertRevert(adminContract.setBAMMPendingOwnership(B, {from: A}), "only market admin can change ownership")

      // try to set new admin before pending was set
      await assertRevert(adminContract.transferBAMMOwnership({from: A}), "pending owner is 0")

      // test new admin from compoud admin
      await adminContract.setBAMMPendingOwnership(B, {from: shmuel})      
      assert.equal(await adminContract.pendingOwner(), B)

      // try to set new admin before 14 days elapse
      await assertRevert(adminContract.transferBAMMOwnership({from: A}), "too early")

      // move two weeks into the future and change admin
      await th.fastForwardTime(60 * 60 * 24 * 14 + 1, web3.currentProvider)
      await adminContract.transferBAMMOwnership({from: A})
      assert.equal(await bamm.owner(), B)
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
