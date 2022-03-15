const { assert } = require("hardhat")
const deploymentHelper = require("./../../utils/deploymentHelpers.js")
const testHelpers = require("./../../utils/testHelpers.js")
const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const CPriceFeed = artifacts.require("CPriceFeed.sol")
const BAMM = artifacts.require("BAMM.sol")
const SWAP = artifacts.require("Swap.sol")
const CollateralAdder = artifacts.require("CollateralAdder.sol")
const MockToken = artifacts.require("MockToken")

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
    shmuel, eitan
  ] = accounts;

  let priceFeed

  const comptrollerAddress = "0x0f390559f258eb8591c8e31cf0905e97cf36ace2"
  const hUSDC = "0xfCD8570AD81e6c77b8D252bEbEBA62ed980BD64D"
  const hETH = "0x8e15a22853A0A60a0FBB0d875055A8E66cff0235"
  const hWBTC = "0xb4300e088a3AE4e624EE5C71Bc1822F68BB5f2bc"
  const hUSDT = "0x607312a5C671D0C511998171e634DE32156e69d0"
  const hLINK = "0x103f2CA2148B863942397dbc50a425cc4f4E9A27"
  const hSushi = "0xEbd7f3349AbA8bB15b897e03D6c1a4Ba95B55e31"
  const hMIM = "0x376020c5B0ba3Fd603d7722381fAA06DA8078d8a"
  const hSpell = "0x29DDb4c4f9baAe366DbD40eff79d364e004425b0"
  const hDODO = "0x772918d032cFd4Ff09Ea7Af623e56E2D8D96bB65"
  const hFRAX = "0xb1c4426C86082D91a6c097fC588E5D5d8dD1f5a8"
  const hDAI = "0x6bb6ebCf3aC808E26545d59EA60F27A202cE8586"

  const hUSDCPrice = 0.0200430514
  const hETHPrice = 55.043296
  const hWBTCPrice = 840.863789
  const hUSDTPrice = 0.020067073
  const hLINKPrice = 0.278401296
  const hSushiPrice = 0.062223894
  const hMIMPrice = 0.0200724371
  const hSpellPrice = 8.00002264e-5
  const hDODOPrice = 0.00812124008
  const hFRAXPrice = 0.0199945725
  const hDAIPrice = 0.0199992603

  const htokens = [hUSDC, hETH, hWBTC, hUSDT, hLINK, hSushi, hMIM, hSpell, hDODO, hFRAX, hDAI]
  const htokenPrices = [hUSDCPrice, hETHPrice, hWBTCPrice, hUSDTPrice, hLINKPrice, hSushiPrice, hMIMPrice, hSpellPrice, hDODOPrice, hFRAXPrice, hDAIPrice]
  const htokenStrings = ["hUSDC", "hETH", "hWBTC", "hUSDT", "hLINK", "hSushi", "hMIM", "hSpell", "hDODO", "hFRAX", "hDAI"]

  const yaron = "0x23cBF6d1b738423365c6930F075Ed6feEF7d14f3"

  describe("Oracle", async () => {

    before(async () => {
      

      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [yaron], 
      })      
    })

    beforeEach(async () => {

    })

    it("test price", async () => {
      priceFeed = await CPriceFeed.new(comptrollerAddress)
      for(let j = 0 ; j < htokens.length ; j++) {
        const base = htokens[j]
        const basePrice = htokenPrices[j]
        const baseName = htokenStrings[j]
        for(let i = 0 ; i < htokens.length ; i++) {
          const dest = htokens[i]
          const name = htokenStrings[i]
          const dstPrice = htokenPrices[i]

          const feedPrice = Number(web3.utils.fromWei(await priceFeed.getPrice(base, dest)))
          console.log(baseName + "/" + name, "feed price / real price", feedPrice / (dstPrice / basePrice))
        }
      }
      
      //const feedPrice = Number(web3.utils.fromWei(await priceFeed.getPrice(hFRAX, hUSDC)))
      //console.log({feedPrice})
      //console.log(web3.utils.fromWei(price)) // 0.0715762425
      //0.0715762425
      //const hLinkPrice = 0.278401296
      //const hFraxPrice = 0.0199945725
    })

    it("test price", async () => {
      const priceFeed = await CPriceFeed.at("0x0ab366dBbb03C84F581963a4CC0756eB66176Bde")
      const bamm = await BAMM.at("0xa00CdcEdE860cD5853DaF52F0C8D70bfD1Db2A79")
      const adder = await CollateralAdder.at("0x6a28E379391C9a8113Ba83ffBBEA6208f2cf053d")
      //await bamm.transferOwnership(adder.address, {from: yaron})

      const nonhUSDC = [hETH, hWBTC, hUSDT, hLINK, hSushi, hMIM, hSpell, hDODO, hFRAX, hDAI]
      //await adder.add(nonhUSDC, bamm.address, priceFeed.address, {from: yaron})

      const price = await bamm.fetchPrice(hFRAX)

      console.log("oracle price", web3.utils.fromWei(price), "real price", hFRAXPrice / hUSDCPrice )

        const base = hUSDC
        const basePrice = hUSDCPrice
        const baseName = "hUSDC"
        for(let i = 0 ; i < htokens.length ; i++) {
          const dest = htokens[i]
          const name = htokenStrings[i]
          const dstPrice = htokenPrices[i]

          if(dest == hUSDC) continue

          const feedPrice = Number(web3.utils.fromWei(await bamm.fetchPrice(dest)))
          console.log(baseName + "/" + name, "feed price / real price", feedPrice / (dstPrice / basePrice))
        }

      console.log("admin", await bamm.owner())
  
      //const feedPrice = Number(web3.utils.fromWei(await priceFeed.getPrice(hFRAX, hUSDC)))
      //console.log({feedPrice})
      //console.log(web3.utils.fromWei(price)) // 0.0715762425
      //0.0715762425
      //const hLinkPrice = 0.278401296
      //const hFraxPrice = 0.0199945725
    })
    
    it.only("swap", async () => {
      //0.1 of link
      const bamm = await BAMM.at("0xa00CdcEdE860cD5853DaF52F0C8D70bfD1Db2A79")      
      console.log("deploying swap")
      const swap = await SWAP.new()
      const cusdc = await MockToken.at("0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8")
      console.log("giving allowance")
      const qty = "1000000"
      await cusdc.approve(swap.address, qty, {from: yaron})

      const link = await MockToken.at("0xf97f4df75117a78c1A5a0DBb814Af92458539FB4")

      console.log("checking link balance")
      console.log((await link.balanceOf(yaron)).toString())

      console.log("doing swap to link")
      await swap.swap(bamm.address, qty, hLINK, 0, {from: yaron})

      console.log("checking link balance")
      console.log((await link.balanceOf(yaron)).toString())

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