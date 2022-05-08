const { artifacts, web3 } = require("hardhat")

const deploy = async(unitrollerAddress, hstableNames, feePool, maxDiscount, adminOwner, txData) => {
    const unitrollerContract = await artifacts.require("MockUnitroller").at(unitrollerAddress)
    console.log("fetching htokens")
    const hTokens = await unitrollerContract.getAllMarkets()
    //console.log({hTokens})
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

    console.log("deploy CFeed")
    const CFeed = artifacts.require("CPriceFeed")
    const cFeed = await CFeed.new(unitrollerAddress,txData)
    console.log("cFeed", cFeed.address)
  
    console.log("deploy collateral adder")
    const Adder = artifacts.require("CollateralAdder")
    const adder = await Adder.new(txData)
    console.log("adder", adder.address)
  
    console.log("admin of adder", await adder.admin())
    
    const _maxDiscount = maxDiscount
    const _feePool = feePool
  
    const BAMM = artifacts.require("HundredBAMM")

    for(let i = 0 ; i < hStables.length ; i++) {
      const hstable = hStables[i]
      const name = hstableNames[i]
      console.log("deploying bamm", hstable)
      const _cBorrow = hstable
      const bamm = await BAMM.new(_cBorrow, false, _maxDiscount, _feePool, txData)
      console.log("bamm", name, bamm.address)
  
      console.log("setting fees")
      await bamm.setParams("20", "100", "100", txData)
  
      console.log("transfer admin to adder")
      await bamm.transferOwnership(adder.address, txData)
  
      console.log("add collaterals")
      await adder.add(hTokens.filter(e=> e !== hstable), bamm.address, cFeed.address, txData)
      console.log("done")

      console.log("deploy admin")
      const admin = await artifacts.require("Admin").new(unitrollerAddress, bamm.address, txData)
      console.log("deployed admin", admin.address)

      console.log("transferOwnership to admin")
      await bamm.transferOwnership(admin.address, txData)

      console.log("transfer admin of admin...")
      await admin.transferOwnership(adminOwner, txData)
    }

    console.log("==================")
    console.log("deployment is over")
  }


  async function ftmDeploy() {
    const unitroller = "0x0f390559f258eb8591c8e31cf0905e97cf36ace2"
    const hStables = ["hUSDC", "hUSDT", "hMIM", "hFRAX", "hDAI"]
    const feePool = "0x8F95C99D8f2D03729C1300E59fc38299D831a7F7"
    const adminOwner = "0xf7D44D5a28d5AF27a7F9c8fc6eFe0129e554d7c4"
    deploy(unitroller, hStables, feePool, 400, adminOwner,{gas: 6000000})
  }

  async function iotexDeploy() {
    const unitroller = "0x8c6139FF1E9D7c1E32bDAFd79948d0895bA0a831"
    const hStables = ["hBUSD", "hUSDT","hUSDC", "hDAI"]
    const feePool = "0x207A0B6b61815c870b9e85B3DA7e26778DD5dff7"
    const adminOwner = "0xf7D44D5a28d5AF27a7F9c8fc6eFe0129e554d7c4"    
    deploy(unitroller, hStables, feePool, 800, adminOwner,{gas: 6000000})
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

  function normalize(bn, decimals) {
    const factor = web3.utils.toBN("10").pow(web3.utils.toBN(18 - decimals))
    return web3.utils.fromWei(web3.utils.toBN(bn).mul(factor))
  }

  async function fethOraclePrices(unitrollerAddress, bamms) {
    const BAMM = artifacts.require("HundredBAMM")
    const unitrollerContract = await artifacts.require("MockUnitroller").at(unitrollerAddress)
    console.log("fetching htokens")
    const hTokens = await unitrollerContract.getAllMarkets()

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
        console.log(collatName + "/" + stableName, normalize(price,18))
      }
    }
  }  

  async function ftmDepositToHtoken(unitrollerAddress, executer) {
    const unitrollerContract = await artifacts.require("MockUnitroller").at(unitrollerAddress)
    console.log("fetching htokens")
    const hTokens = await unitrollerContract.getAllMarkets()
    for(let i = 0 ; i < hTokens.length ; i++) {
      const token = await artifacts.require("MockToken").at(hTokens[i])
      const symbol = await token.symbol()
      if(symbol === "hFTM") continue
      console.log(symbol)
      console.log("getting underlying")
      const htoken = await artifacts.require("MockCToken").at(hTokens[i])
      const underlyingToken = await artifacts.require("MockToken").at(await htoken.underlying())
      const balance = await underlyingToken.balanceOf(executer)
      console.log("give allowance")
      await underlyingToken.approve(hTokens[i], balance)
      console.log("mint")
      await htoken.mint(balance)
      console.log("done")
    }
  }

  //ftmDeploy()
  //ftmDepositToHtoken("0x0f390559f258eb8591c8e31cf0905e97cf36ace2", "0xb69Dd1e9Fe391E1F36b01F00bb6a9d9303EE3E13")
  //iotexDeploy()

  fethOraclePrices("0x8c6139FF1E9D7c1E32bDAFd79948d0895bA0a831",
                ["0x4Db1d29eA5b51dDADcc5Ab26709dDA49e7eB1E71",
                "0x8cF0B1c886Ee522427ef57F5601689352F8161eb",
                "0x7D30d048F8693aF30A10aa5D6d281A7A7E6E1245",
                "0xCE0A876996248421606F4ad8a09B1D3E15f69EfB"])
  
/*
  depositToBamm("0x8c6139FF1E9D7c1E32bDAFd79948d0895bA0a831",
                ["0x4Db1d29eA5b51dDADcc5Ab26709dDA49e7eB1E71","0x8cF0B1c886Ee522427ef57F5601689352F8161eb",
                "0x7D30d048F8693aF30A10aa5D6d281A7A7E6E1245","0xCE0A876996248421606F4ad8a09B1D3E15f69EfB"],
                "0xb69Dd1e9Fe391E1F36b01F00bb6a9d9303EE3E13")

*/
  ///const deploy = async(unitrollerAddress, hstableNames, feePool, maxDiscount)