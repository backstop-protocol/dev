const Web3 = require("web3")
const axios = require("axios")

const secret = require("./secret.json")
const bytecodes = require("./bytecodes.json")
const abi = require("./abi.json")
const web3 = new Web3(secret.nodeEndPoint)
const {uploadJsonFile} = require("./s3-client")


const fileName = "liquidatorStoredData.json"
let storedData = {
    accounts: [],
    lastCoveredBlock: 1338448 + 100
}

function handleCETHEvent(e) {
    const to = e.returnValues.to
    if(! storedData.accounts.includes(to)) storedData.accounts.push(to)    
}

async function readAllUsers(startBlock, lastBlock) {
    const step = 100000
    console.log({lastBlock}) 
    const cETH = new web3.eth.Contract(abi.cEthAbi, "0x8e15a22853A0A60a0FBB0d875055A8E66cff0235")
    //console.log({cETH})
    for(let i = startBlock; i < lastBlock  ; i += step) {
        let start = i
        let end = i + step - 1
        if(end > lastBlock) end = lastBlock

        const events = await cETH.getPastEvents("Transfer", {fromBlock: start, toBlock:end})
        console.log({i}, events.length, storedData.accounts.length)

        for(let j = 0 ; j < events.length ; j++) {
            handleCETHEvent(events[j])
        } 
    }

    console.log("num users", storedData.accounts.length)
}

async function updateUsers() {
    console.log("updating users")
    const currBlock = await web3.eth.getBlockNumber() - 10
    if(currBlock > storedData.lastCoveredBlock) {
        await readAllUsers(storedData.lastCoveredBlock - 50, currBlock)
    }

    storedData.lastCoveredBlock = currBlock

    console.log("updateUsers end")
    //setTimeout(updateUsers, 1000 * 60);    
}

async function liquidateCheck(accountsForHelper) {
    const helperContract = new web3.eth.Contract(abi.helperAbi, "0xE7D1406Cc09F6444973C798393F393f7E57e001f")
    const bytecode = bytecodes.LiquidationBotHelper

    const comptroller = "0x0F390559F258eB8591C8e31Cf0905E97cf36ACE2"
    const bamms = ["0x04208f296039f482810B550ae0d68c3E1A5EB719", "0x24099000AE45558Ce4D049ad46DDaaf71429b168"]

    const result = await helperContract.methods.getInfo(bytecode, accountsForHelper, comptroller, bamms).call({gas: 1000000000})
    console.log({result})
    if(result.users.length > 0) {
        console.log("found liquidation candidate")
        await doLiquidate(result.users[0], result.bamm[0], result.repayAmount[0])
        console.log("done")
    }

    console.log("liquidateCheck end")    
}

async function readStoredDataFromS3 () {
    try{
        const {data} = await axios.get(secret.s3Bucket + fileName)
        console.log("stored accounts= ", data.accounts.length)
        storedData = data
    }
    catch(err) {
        console.log(err)
    }
}

async function writeStoredDataToS3() {
    await uploadJsonFile(JSON.stringify(storedData, null, 2), fileName);
}

async function doLiquidate(user, bammAddress, repayAmount) {
    const privKey = secret.privateKey
    const account = web3.eth.accounts.privateKeyToAccount(privKey)

    web3.eth.accounts.wallet.clear()
    web3.eth.accounts.wallet.add(account)
    
    const bammContract = new web3.eth.Contract(abi.BAMMAbi, bammAddress)
    await bammContract.methods.liquidateBorrow(user, repayAmount, "0x8e15a22853A0A60a0FBB0d875055A8E66cff0235").send({from: account.address, gas:3120853})
}

async function run() {
    await updateUsers()
    for(let i = 0 ; i < storedData.accounts.length ; i += 50) {
        await liquidateCheck(storedData.accounts.slice(i, i + 50))        
    }
}

async function runOnLambda() {
    await readStoredDataFromS3()
    await run() 
    await writeStoredDataToS3()
}



module.exports = {
    run,
    runOnLambda
}