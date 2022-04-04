const Web3 = require("web3")

const secret = require("./secret.json")
const abi = require("./abi.json")
const config = require("./config.json")

const web3 = new Web3(secret.nodeEndPoint)

// checkUpkeep
const check = async () => {
  console.log("checking upkeep...")
  const bKeeper = new web3.eth.Contract(abi.bKeeper, config.keeperAddress)
  const {upkeepNeeded, performData} = await bKeeper.methods.checkUpkeep("0x").call({gas: 100000000})
  return {upkeepNeeded, performData}
}

// preform
const preform = async (data) => {
  const {privateKey} = secret
  const account = web3.eth.accounts.privateKeyToAccount(privateKey)
  web3.eth.accounts.wallet.clear()
  web3.eth.accounts.wallet.add(account)
  console.log("preforming upkeep...")
  const bKeeper = new web3.eth.Contract(abi.bKeeper, config.keeperAddress)
  const gasPrice = await web3.eth.getGasPrice()
  await bKeeper.methods.performUpkeep(data).send({from: account.address, gas:3120853, gasPrice})
}

const run = async () => {
  const {upkeepNeeded, performData} = await check()
  console.log(`upkeep ${upkeepNeeded? "is" : "not"} needed`)
  if(upkeepNeeded){
    await preform(performData)
  }
  console.log("all done!")
}

module.exports = {
  runBKeeper: run
}

