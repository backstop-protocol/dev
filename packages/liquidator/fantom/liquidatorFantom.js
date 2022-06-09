const Web3 = require("web3")
const axios = require("axios")
const {toWei} = Web3.utils
const secret = require("../secret.json")
const configJson = require("./fantomConfig.json")
const abi = require("../abi.json")
const web3 = new Web3(secret.nodeEndPoint)
const {uploadJsonFile} = require("../s3-client")


const fileName = configJson.fileName
let storedData = {
    accounts: [],
    lastCoveredBlock: configJson.startBlock//20683828 + 1
}

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

function handleEvent(e) {
    const to = e.returnValues.account
    if(! storedData.accounts.includes(to)) storedData.accounts.push(to)    
}

async function readAllUsers(startBlock, lastBlock) {
    const step = 3500
    const unitroller = new web3.eth.Contract(abi.comptroller, configJson.comptrollerAddress)
    console.log({startBlock}, {lastBlock}) 

    for(let i = startBlock; i < lastBlock  ; i += step) {
        let start = i
        let end = i + step - 1
        if(end > lastBlock) end = lastBlock
        console.log({start}, {end})
        const events = await unitroller.getPastEvents("MarketEntered", {fromBlock: start, toBlock:end})
        console.log({i}, events.length, storedData.accounts.length)

        for(let j = 0 ; j < events.length ; j++) {
            handleEvent(events[j])
        } 
    }

    console.log("num users", storedData.accounts.length)
}

async function updateUsers() {
    console.log("updating users")
    const currBlock = await web3.eth.getBlockNumber() - 10
    if(currBlock > storedData.lastCoveredBlock) {
        console.log("reading users")
        await readAllUsers(storedData.lastCoveredBlock - 50, currBlock)
    }

    storedData.lastCoveredBlock = currBlock

    console.log("updateUsers end")
    //setTimeout(updateUsers, 1000 * 60);    
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }

    return array
}

async function liquidateCheck(accountsForHelper) {
    const helperContract = new web3.eth.Contract(abi.helperAbi, configJson.helperAddress)

    const comptroller = configJson.comptrollerAddress
    const bammsOrdered = configJson.bammAddresses
    const bamms = shuffleArray(bammsOrdered)

    console.log({bamms})

    console.log("calling helper")
    //console.log({accountsForHelper})
    const result = await helperContract.methods.getInfo(accountsForHelper, comptroller, bamms).call({gas: 40000000000000})
    if(result.length > 0) {
        console.log("found liquidation candidate", result[0])
        await doLiquidate(result[0].account, result[0].bamm, result[0].ctoken, result[0].repayAmount)
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

async function doLiquidate(user, bammAddress, ctoken, repayAmount) {
    const privKey = secret.privateKey
    const account = web3.eth.accounts.privateKeyToAccount(privKey)

    web3.eth.accounts.wallet.clear()
    web3.eth.accounts.wallet.add(account)
    
    const bammContract = new web3.eth.Contract(abi.BAMM, bammAddress)
    const gasPrice = await getGasPrice()
    await bammContract.methods.liquidateBorrow(user, repayAmount, ctoken).send({from: account.address, gas:3120853, gasPrice})
}

async function run() {
    await updateUsers()
    for(let i = 0 ; i < storedData.accounts.length ; i += 50) {
        const slice = storedData.accounts.slice(i, i + 50)
        console.log({slice})
        await liquidateCheck(slice)
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

