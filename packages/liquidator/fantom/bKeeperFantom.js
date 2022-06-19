const Web3 = require("web3")
const {toWei} = Web3.utils

const secret = require("./secret.json")
const abi = require("./abi.json")
const config = require("./fantomConfig.json")

const web3 = new Web3(secret.nodeEndPoint)

const getGasPrice = async () => {
  try{
      const {data} = await axios.get("https://gftm.blockscan.com/gasapi.ashx?apikey=key&method=pendingpooltxgweidata")
      const gasPriceGwei = data.result.standardgaspricegwei.toString()
      return toWei(gasPriceGwei, 'gwei')
  } catch (e) {
      console.error(err)
      return null
  }
}

// checkUpkeep
const check = async () => {

  console.log("checking upkeep...")
  const bKeeper = new web3.eth.Contract(abi.bKeeper, config.keeperAddress)
  const numHints = await bKeeper.methods.getNumHints().call()
  for (let i = 0; i < Number(numHints); i++) {
    console.log("  - hint: " + i)
    const {upkeepNeeded, performData} = await bKeeper.methods.checkUpkeep(i).call({gas: 100000000})
    if(upkeepNeeded){
      return {upkeepNeeded, performData}
    }
  }
  return {upkeepNeeded: false}
}

// preform
const preform = async (data) => {
  const {privateKey} = secret
  const account = web3.eth.accounts.privateKeyToAccount(privateKey)
  web3.eth.accounts.wallet.clear()
  web3.eth.accounts.wallet.add(account)
  console.log("preforming upkeep...")
  const bKeeper = new web3.eth.Contract(abi.bKeeper, config.keeperAddress)
  const gasPrice = await getGasPrice()
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

