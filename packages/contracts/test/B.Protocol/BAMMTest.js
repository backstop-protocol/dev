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
      token2 = await MockToken.new(14)

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

      await bamm.addCollateral(token0.address, priceFeed0.address, {from: bammOwner})
      await bamm.addCollateral(token1.address, priceFeed1.address, {from: bammOwner})
      await bamm.addCollateral(token2.address, priceFeed2.address, {from: bammOwner})
    })

    it("liquidateBorrow MockCtoken", async () => {
      const liquidationAmount = toBN(dec(1000, 7))
      const collateralAmount = liquidationAmount.mul(toBN(3))
      await lusdToken.mintToken(shmuel, liquidationAmount, {from: shmuel})
      await lusdToken.approve(cLUSD.address, liquidationAmount, {from: shmuel})
      await cETH.depositEther({ from: yaron, value: collateralAmount})

      await cLUSD.setCETHPrice(toBN(dec(3, 18)))
      await cLUSD.liquidateBorrow(yaron, liquidationAmount, cETH.address, {from: shmuel})
      const shmuelsCEthBalance = await cETH.balanceOf(shmuel)
      assert.equal(shmuelsCEthBalance.toString(), collateralAmount.toString())
    })

    it("fails to liquidateBorrow MockCtoken when not enough funds", async () => {
      const liquidationAmount = toBN(dec(1000, 7))
      const collateralAmount = liquidationAmount.mul(toBN(3))
      await lusdToken.mintToken(shmuel, liquidationAmount, {from: shmuel})
      await lusdToken.approve(cLUSD.address, liquidationAmount, {from: shmuel})
      await cETH.depositEther({ from: yaron, value: collateralAmount})

      await cLUSD.setCETHPrice(toBN(dec(3, 18)))
      await assertRevert(
        cLUSD.liquidateBorrow(yaron, liquidationAmount.add(toBN(1)), cETH.address, {from: shmuel})
      , "SafeMath: subtraction overflow")
    })

    it("liquidateBorrow bamm", async () => {
      await bamm.setParams(20, 100, 50, {from: bammOwner})
      const liquidationAmount = toBN(dec(1000, 7))
      const collateralAmount = toBN(dec(3000, 18))
      await lusdToken.mintToken(shmuel, liquidationAmount, {from: shmuel})
      await lusdToken.approve(bamm.address, liquidationAmount, {from: shmuel})
      await cETH.depositEther({ from: yaron, value: collateralAmount})
      await bamm.deposit(liquidationAmount, {from: shmuel})
      const callerEthBalanceBefore = toBN(await web3.eth.getBalance(shmuel))

      const expectedCallerFee = collateralAmount.div(toBN(200)) // 0.5%
      await cLUSD.setCETHPrice(toBN(dec(3, 18+11)))

      await bamm.liquidateBorrow(yaron, liquidationAmount, cETH.address, {from: shmuel})
      
      const callerEthBalanceAfter = toBN(await web3.eth.getBalance(shmuel))
      const bammEthBalance = await web3.eth.getBalance(bamm.address)
      const expectdEthBalance = collateralAmount.sub(expectedCallerFee)
      assert.equal(bammEthBalance.toString(), expectdEthBalance.toString())
      const bammLusdBalance = await lusdToken.balanceOf(bamm.address)
      assert.equal(bammLusdBalance.toString(), "0")
      const callerEthDelta = callerEthBalanceAfter.sub(callerEthBalanceBefore)
      const onePercent = expectedCallerFee.div(toBN(100))
      // caller fee reward minus gass fee to call the liquidateBorrow
      // should result in a plus of 99% of the expected caller fee in the caller eth balance
      assert.equal(isWithin99Percent(onePercent, callerEthDelta), true)
    })


    it("reverts when liquidation discount is too low", async ()=>{
      await bamm.setParams(20, 100, 50, {from: bammOwner})
      const liquidationAmount = toBN(dec(1000, 7))
      const collateralAmount = toBN(dec(3000, 18))
      await lusdToken.mintToken(shmuel, liquidationAmount, {from: shmuel})
      await lusdToken.approve(bamm.address, liquidationAmount, {from: shmuel})
      await cETH.depositEther({ from: yaron, value: collateralAmount})
      await bamm.deposit(liquidationAmount, {from: shmuel})

      await cLUSD.setCETHPrice(toBN(dec(103, 18+11-5))) // 1.03 ETH per 1000 USDT
      await priceFeed.setPrice(dec(1000, 18));
      // const min = "1.04ETH"
      await assertRevert(
        bamm.liquidateBorrow(yaron, liquidationAmount, cETH.address, {from: shmuel}),
        "liquidation discount is too low"
      )
    })
    
    it("canLiquidate", async ()=> {
      const liquidationAmount = toBN(dec(1000, 7))

      await lusdToken.mintToken(shmuel, liquidationAmount, {from: shmuel})
      await lusdToken.approve(bamm.address, liquidationAmount, {from: shmuel})
      await bamm.deposit(liquidationAmount, {from: shmuel})
      await cLUSD.setCETHPrice(toBN(dec(3, 18)))

      const canLiquidate = await bamm.canLiquidate(cLUSD.address, cETH.address, liquidationAmount)
      assert.equal(canLiquidate, true)

      const cantLiquidate = await bamm.canLiquidate(cLUSD.address, cETH.address, liquidationAmount.add(toBN(1)))
      assert.equal(cantLiquidate, false)

      const canLiquidate1 = await bamm.canLiquidate(cLUSD.address, cLUSD.address, liquidationAmount)
      assert.equal(canLiquidate1, false)

      const canLiquidate2 = await bamm.canLiquidate(cETH.address, cETH.address, liquidationAmount.add(toBN(1)))
      assert.equal(canLiquidate2, false)
    })

    // --- provideToSP() ---
    // increases recorded LUSD at Stability Pool
    it.only("deposit(): increases the Stability Pool LUSD balance", async () => {
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
    it.only("deposit(): two users deposit, check their share", async () => {
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
    it.only("deposit(): two users deposit, one withdraw. check their share", async () => {
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

    it.only('test share with collateral', async () => {
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
      await token2.mintToken(bamm.address, toBN(dec(500, 14))) // $2k

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
      assert.equal(toBN(dec(250, 14)).toString(), token2BalAfter.sub(token2BalBefore).toString())
    })

    it.only('price exceed max dicount and/or collateral balance', async () => {
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

    it.only('test getSwapAmount', async () => {
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
      await token2.mintToken(bamm.address, toBN(dec(1, 14)))      
      
      const lusdQty = dec(105, 7)
      const expectedReturn = await bamm.getReturn(lusdQty, dec(6000, 7), toBN(dec(6000, 7)).add(toBN(dec(2 * 420, 7))), 200)

      // without fee
      await bamm.setParams(200, 0, 0, {from: bammOwner})
      const priceWithoutFee = await bamm.getSwapAmount(lusdQty, token0.address)
      assert.equal(priceWithoutFee.toString(), expectedReturn.mul(toBN(dec(1,12 - 7))).div(toBN(105)).toString())
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