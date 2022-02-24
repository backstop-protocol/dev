const Web3 = require("web3")

const secret = require("./secret.json")
const abi = require("./abi.json")

const web3 = new Web3(secret.nodeEndPoint)

// checkUpkeep
const check = async address => {
  console.log(`checking upkeep for ${address}`)
  const bKeeper = new web3.eth.Contract(abi.bKeeper, address)
  const {upkeepNeeded, performData} = await bKeeper.methods.checkUpkeep("0x").call({gas: 100000000})
  return {upkeepNeeded, performData}
}

// preform
const preform = async (data, address) => {
  const {privateKey} = secret
  const account = web3.eth.accounts.privateKeyToAccount(privateKey)
  web3.eth.accounts.wallet.clear()
  web3.eth.accounts.wallet.add(account)
  console.log("preforming upkeep...")
  const bKeeper = new web3.eth.Contract(abi.bKeeper, address)
  await bKeeper.methods.performUpkeep(data).send({from: account.address, gas:3120853})
}

const run = async address => {
  const {upkeepNeeded, performData} = await check(address)
  console.log(`upkeep ${upkeepNeeded? "is" : "not"} needed`)
  if(upkeepNeeded){
    await preform(performData, address)
  }
  console.log("all done!")
}

const runAll = async () => {
  await run("0x102887d6bFC58B0abE721AAD1ce5A036ACe542c8");
  await run("0xDdcAF169cE7d42f8D486DF5582Da8D0aC48E0323");
}

module.exports = {
  runBKeeper: runAll
}


