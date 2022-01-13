const Web3 = require("web3")
const axios = require("axios")

const secret = require("./secret.json")
const abi = require("./abi.json")
const web3 = new Web3(secret.nodeEndPoint)
const {uploadJsonFile} = require("./s3-client")


const fileName = "liquidatorStoredData.json"
let storedData = {
    accounts: [],
    lastCoveredBlock: 20683828 + 1
}

function handleEvent(e) {
    const to = e.returnValues.account
    //if(to !== "0xdbbf063782B8BEbFD34D88E3043531bBC7a8D82b")
    if(! storedData.accounts.includes(to)) storedData.accounts.push(to)    
}

async function readAllUsers(startBlock, lastBlock) {
    const step = 100000
    const unitroller = new web3.eth.Contract(abi.comptroller, "0x0F390559F258eB8591C8e31Cf0905E97cf36ACE2")
    console.log({lastBlock}) 

    for(let i = startBlock; i < lastBlock  ; i += step) {
        let start = i
        let end = i + step - 1
        if(end > lastBlock) end = lastBlock

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
        await readAllUsers(storedData.lastCoveredBlock - 50, currBlock)
    }

    storedData.lastCoveredBlock = currBlock

    console.log("updateUsers end")
    //setTimeout(updateUsers, 1000 * 60);    
}

async function liquidateCheck(accountsForHelper) {
    const helperContract = new web3.eth.Contract(abi.helperAbi, "0x45E305549636F29bAd41F4683fC94ec119A9eD24")

    const comptroller = "0x0F390559F258eB8591C8e31Cf0905E97cf36ACE2"
    const bamms1 = ["0xEDC7905a491fF335685e2F2F1552541705138A3D", "0x6d62d6Af9b82CDfA3A7d16601DDbCF8970634d22"]
    const bamms2 = [].concat(bamms1).reverse()
    const rand = (Math.floor(+new Date() / 1000)) % 2
    console.log({rand})
    const bamms = (rand == 0) ? bamms1 : bamms2

    //console.log("calling helper")
    //console.log({accountsForHelper})
    const result = await helperContract.methods.getInfo(accountsForHelper, comptroller, bamms).call({gas: 40000000000000})
    if(result.length > 0) {
        console.log("found liquidation candidate", result[0])
        await doLiquidate(result[0].account, result[0].bamm, result[0].ctoken, result[0].repayAmount)
        console.log("done")
    }

    //console.log("liquidateCheck end")    
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
    await bammContract.methods.liquidateBorrow(user, repayAmount, ctoken).send({from: account.address, gas:3120853})
}

async function run() {
    await updateUsers()
    for(let i = 0 ; i < storedData.accounts.length ; i += 50) {
        const slice = storedData.accounts.slice(i, i + 50)
        //console.log({slice})
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

