const { artifacts, web3 } = require("hardhat")


const deploy = async(lendingPoolAddressesProviderAddress,
                      hTokens, hstableNames, maxDiscount, adminOwner, txData) => {
    console.log("deploying fee pool")
    const FeePool = artifacts.require("FeeVault")
    const feePoolContract = await FeePool.new(adminOwner, txData)
    console.log("fee pool address", feePoolContract.address)
    const _feePool = feePoolContract.address

    const hTokenNames = []
    const hStables = []
    //const hstableNames = []
    console.log('reading token names')
    for(let i = 0 ; i < hTokens.length ; i++) {
      const ctoken = await artifacts.require("MockCToken").at(hTokens[i])
      const name = await ctoken.symbol()
      isStable = (hstableNames.indexOf(name) > -1)
      hTokenNames.push(name)
      if(isStable) {
        hStables.push(hTokens[i])
        hstableNames.push(name)
      }

      console.log(name, hTokens[i], isStable)
    }

    console.log("deploy AFeed")
    const AFeed = artifacts.require("APriceFeed")
    const aFeed = await AFeed.new(lendingPoolAddressesProviderAddress,txData)
    console.log("aFeed", aFeed.address)
  
    console.log("deploy collateral adder")
    const Adder = artifacts.require("CollateralAdder")
    const adder = await Adder.new(txData)
    console.log("adder", adder.address)
  
    console.log("admin of adder", await adder.admin())
    
    const _maxDiscount = maxDiscount
  
    const BAMM = artifacts.require("AaveBAMM")

    for(let i = 0 ; i < hStables.length ; i++) {
      const hstable = hStables[i]
      const name = hstableNames[i]

      console.log("deploying ctoken adapter", hstable)
      const AaveToCToken = artifacts.require("AaveToCTokenAdapter.sol")
      const cBorrow = await AaveToCToken.new(hstable, lendingPoolAddressesProviderAddress, txData)
      console.log("cBorrow address", cBorrow.address)
      
      console.log("deploying bamm", hstable)
      const _cBorrow = cBorrow.address
      const bamm = await BAMM.new(_cBorrow, false, _maxDiscount, _feePool, txData)
      console.log("bamm", name, bamm.address)

      console.log("set cborrow owner as bamm")
      await cBorrow.setBAMM(bamm.address, txData)

      console.log("deploy all adapters")
      const collateralAdapters = []
      for(const hToken of hTokens) {
        if(hToken === hstable) continue
        /*

        console.log("deploying adapter to ", hToken)
        const aToken = await AaveToCToken.new(hToken, lendingPoolAddressesProviderAddress, txData)        
        console.log("adapter address" , aToken.address)

        console.log("setting bamm as adapter owner")
        await aToken.setBAMM(bamm.address, txData)

        */

        // collaterals do not need adapters
        collateralAdapters.push(hToken)

        /*
        console.log("add collateral to bamm - for testing")
        await bamm.addCollateral(aToken.address, aToken.address)
        */
      }

      console.log("setting fees")
      await bamm.setParams("20", "100", "100", txData)
  
      console.log("transfer admin to adder")
      await bamm.transferOwnership(adder.address, txData)
  
      console.log("add collaterals")
      await adder.add(collateralAdapters, bamm.address, aFeed.address, txData)
      console.log("done")

      /*
      console.log("deploy admin")
      const admin = await artifacts.require("Admin").new(unitrollerAddress, bamm.address, txData)
      console.log("deployed admin", admin.address)

      console.log("transferOwnership to admin")
      await bamm.transferOwnership(admin.address, txData)

      console.log("transfer admin of admin...")
      await admin.transferOwnership(adminOwner, txData)*/
    }

    console.log("==================")
    console.log("deployment is over")
  }

  async function nervos_deploy() {
    const providerAddress = "0x773E3fAAD7b17147eDD78eE796Ac127e5ad23855"
    const aTokens = [ "0x7b6eeCD5EC8b82cC27359CD6F75818C8bA2B33cd", // aETH
                      "0xbDd52631272E28286DE79A1aE0AE51c5b1660064", // aBNB
                      "0xe609C8861DB284195510ff805E0AeAFd92bb980D", // aWBTC
                      "0xeC2BF7ec6aFCeC1594baf4F33736573d0a12C25E", // aCKB
                      "0x3D8714a8e553FB872Ac3790c49E9480aB1D31342", // aUSDC
                      "0x30D1911E7703aD37d76682735E50a925E4CB9139" // aUSDT
                    ]
    const hstableNames = ["hUSDC.e"]
    const maxDiscount = 400
    const feePoolOwner = "0xC7035d9319654fae4a0aBE9A88121B9D9C36900F"

    await deploy(providerAddress, aTokens, hstableNames, maxDiscount, feePoolOwner, {gas:2000000})
  }

  async function nervos_deploy_testnet() {
    const providerAddress = "0x5492119c74B6c9f72ebF735856C213Dd03AC565F"
    const aTokens = [ "0x8E66CC7Fe7800e93B489161d2aE51bF3E56e7aef", // aETH
                      "0x190b3b34A01A2CA210342AbFe7703bA6E53E741d", // aBNB
                      "0x9AfB608F2313BD7fBD62A515FF1ea8250cEfdF99", // aWBTC
                      "0x72261bd935FDcf36c1Ecd25A499Ad226471BE722", // aCKB
                      "0x64D0B6c2D4d4850da25e80d04F8917dDc99c72fa", // aUSDC
                      "0x683d2100f27e397118BC265c4059577c29cd87f8" // aUSDT
                    ]
    const hstableNames = ["hUSDC.e"]
    const maxDiscount = 400
    const feePoolOwner = "0xC7035d9319654fae4a0aBE9A88121B9D9C36900F"

    await deploy(providerAddress, aTokens, hstableNames, maxDiscount, feePoolOwner, {gas:2000000})
  }  

  

  /*
  async function ftmDeploy() {
    const unitroller = "0x0f390559f258eb8591c8e31cf0905e97cf36ace2"
    const hStables = ["hUSDC", "hUSDT", "hMIM", "hFRAX", "hDAI"]
    const feePool = "0x8F95C99D8f2D03729C1300E59fc38299D831a7F7"
    const adminOwner = "0xf7D44D5a28d5AF27a7F9c8fc6eFe0129e554d7c4"
    deploy(unitroller, hStables, feePool, 400, adminOwner,{gas: 6000000})
  }


  async function depositToBamm(unitrollerAddress, bamms, executer) {
    console.log("user", executer)

    const BAMM = artifacts.require("HundredBAMM")
    const unitrollerContract = await artifacts.require("MockUnitroller").at(unitrollerAddress)
    console.log("fetching htokens")
    const hTokens = await unitrollerContract.getAllMarkets()

    for(const bammAddress of bamms) {
      const bamm = await BAMM.at(bammAddress)
      console.log("get cborrow")
      const stable = await bamm.LUSD()
      console.log({stable})
      console.log("give allowance")
      const token = await artifacts.require("MockToken").at(stable)
      const balance = web3.utils.toBN(await token.balanceOf(executer)).div(web3.utils.toBN("4"))
      console.log("ctoken balance", balance.toString())
      await token.approve(bammAddress, balance)
      console.log("deposit to bamm")
      await bamm.deposit(balance)

      console.log("sending htokens to bamm")
      for(const htoken of hTokens) {
        if(stable === htoken) continue
        const collat = await artifacts.require("MockToken").at(htoken)
        const balance = web3.utils.toBN(await collat.balanceOf(executer)).div(web3.utils.toBN("4"))
        console.log("sending ", await collat.symbol(), "to ", "bamm ", await token.symbol())
        await collat.transfer(bammAddress, balance)
      }

      console.log("withdraw from bamm")
      const amount = web3.utils.toBN(await bamm.balanceOf(executer)).div(web3.utils.toBN("4"))
      await bamm.withdraw(amount)
      console.log("done with bamm")
    }
  }

*/
  function normalize(bn, decimals) {
    const factor = web3.utils.toBN("10").pow(web3.utils.toBN(18 - decimals))
    return web3.utils.fromWei(web3.utils.toBN(bn).mul(factor))
  }

  async function fethOraclePrices(hTokens, bamms) {
    const BAMM = artifacts.require("HundredBAMM")

    for(const bammAddress of bamms) {
      console.log("============================")
      const bamm = await BAMM.at(bammAddress)
      const stable = await bamm.LUSD()
      const token = await artifacts.require("MockToken").at(stable)
      const stableName = await token.symbol()

      for(const htoken of hTokens) {
        if(stable === htoken) continue
        const collat = await artifacts.require("MockToken").at(htoken)
        const collatName = await collat.symbol()

        const price = await bamm.fetchPrice(htoken)
        console.log(collatName + "/" + stableName, normalize(price,18), (await collat.decimals()).toString(), (await token.decimals()).toString())
      }
    }
  }

  //nervos_deploy()

  async function depositAndWithdraw(txData) {
    const aUSDC = await artifacts.require("MockCToken").at("0x3D8714a8e553FB872Ac3790c49E9480aB1D31342")
    const bamm = await artifacts.require("AaveBAMM").at("0xD839F4468A47Ac17321c28669029d069AB73F535")

    console.log("calling get adapter address")
    const adapterAddress = await bamm.cBorrow()
    console.log({adapterAddress})

    const aUSDCAdapter = await artifacts.require("AaveToCTokenAdapter").at(adapterAddress)

    const yaron = "0xC7035d9319654fae4a0aBE9A88121B9D9C36900F"

    console.log("aUSDC balance", (await aUSDC.balanceOf(yaron)).toString())
    console.log((await bamm.cBorrow()))
    console.log((await aUSDCAdapter.owner()))    

    console.log("giving allowance to adapter")
    await aUSDC.approve(aUSDCAdapter.address, "1234566789", {gas:200000})
    
    console.log("calling deposit")
    await bamm.deposit("100", {gas:3000000})

    console.log("aUSDC balance of user", (await aUSDC.balanceOf(yaron)).toString())
    console.log("aUSDC balance of bamm", (await aUSDC.balanceOf(bamm.address)).toString())
    console.log("bamm balance of user", (await bamm.balanceOf(yaron)).toString())

    console.log("withdraw half")
    await bamm.withdraw("500000000000000000", {gas:2000000})

    console.log("aUSDC balance of user", (await aUSDC.balanceOf(yaron)).toString())
    console.log("aUSDC balance of bamm", (await aUSDC.balanceOf(bamm.address)).toString())
    console.log("bamm balance of user", (await bamm.balanceOf(yaron)).toString())    
  }

  //depositAndWithdraw({gas:20000000})
  //nervos_deploy()
  depositAndWithdraw()

/*
  const aTokens = [ "0x7b6eeCD5EC8b82cC27359CD6F75818C8bA2B33cd", // aETH
  "0xbDd52631272E28286DE79A1aE0AE51c5b1660064", // aBNB
  "0xe609C8861DB284195510ff805E0AeAFd92bb980D", // aWBTC
  "0xeC2BF7ec6aFCeC1594baf4F33736573d0a12C25E", // aCKB
  "0x3D8714a8e553FB872Ac3790c49E9480aB1D31342", // aUSDC
  "0x30D1911E7703aD37d76682735E50a925E4CB9139" // aUSDT
]  
  fethOraclePrices(aTokens, ["0x17bC5Bd342A6970335f035abe14D8B23910498Ae"])
  */
/*

  //ftmDeploy()
  //ftmDepositToHtoken("0x0f390559f258eb8591c8e31cf0905e97cf36ace2", "0xb69Dd1e9Fe391E1F36b01F00bb6a9d9303EE3E13")
  //iotexDeploy()

  fethOraclePrices("0x8c6139FF1E9D7c1E32bDAFd79948d0895bA0a831",
                ["0x4Db1d29eA5b51dDADcc5Ab26709dDA49e7eB1E71",
                "0x8cF0B1c886Ee522427ef57F5601689352F8161eb",
                "0x7D30d048F8693aF30A10aa5D6d281A7A7E6E1245",
                "0xCE0A876996248421606F4ad8a09B1D3E15f69EfB"])*/
  
/*
  depositToBamm("0x8c6139FF1E9D7c1E32bDAFd79948d0895bA0a831",
                ["0x4Db1d29eA5b51dDADcc5Ab26709dDA49e7eB1E71","0x8cF0B1c886Ee522427ef57F5601689352F8161eb",
                "0x7D30d048F8693aF30A10aa5D6d281A7A7E6E1245","0xCE0A876996248421606F4ad8a09B1D3E15f69EfB"],
                "0xb69Dd1e9Fe391E1F36b01F00bb6a9d9303EE3E13")

*/
  ///const deploy = async(unitrollerAddress, hstableNames, feePool, maxDiscount)