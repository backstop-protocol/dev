const testHelpers = require("./../../utils/testHelpers.js")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const dec = th.dec
const toBN = th.toBN
const getDifference = th.getDifference

const UniV3Twap = artifacts.require("UniV3Twap.sol");
const twapDuration = 24 * 60 * 60 // 24 hours

contract('PriceFormula tests', async accounts => {
  let twap
 
  before(async () => {
    console.log("deploy twap")
    twap = await UniV3Twap.new(twapDuration)
    console.log(twap.address)
  })

  // numbers here were taken from the return value of mainnet contract

  it("check decimals", async () => {
    assert.equal("18", (await twap.decimals()).toString())
    console.log("querying price")
    const result = await twap.latestRoundData()
    console.log(result.timestamp.toString(), result.answer.toString())
  })
})

