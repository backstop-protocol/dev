const { artifacts } = require("hardhat")
const deploymentHelper = require("./../../utils/deploymentHelpers.js")
const testHelpers = require("./../../utils/testHelpers.js")
const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const Admin = artifacts.require("Admin")
const DesliterAdmin = artifacts.require("DesliterAdmin")
const HundredBAMM = artifacts.require("HundredBAMM")

const comptrollerOwner = "0x1001009911e3FE1d5B45FF8Efea7732C33a6C012"
const adminOwner = "0xf7D44D5a28d5AF27a7F9c8fc6eFe0129e554d7c4"

const delisterAddress = "0xF86cC3b88865Ac7984fB51Cd2b866Dc2C84ecFAC"

const bammUSDT = "0x1EcF1b0DE9b4c2D01554062eA2faB84b1917B41d"
const bammDAI = "0x998Bf304Ce9Cb215F484aA39d1177b8210078f49"
const bammUSDC = "0x0F0dD66D2d6c1f3b140037018958164c6AB80d56"
const bamms = [bammUSDT, bammDAI, bammUSDC]

const hDAI = "0xE4e43864ea18d5E5211352a4B810383460aB7fcC"
const hETH = "0x243E33aa7f6787154a8E59d3C27a66db3F8818ee"
const hWBTC = "0xb4300e088a3AE4e624EE5C71Bc1822F68BB5f2bc"
const hUSDC = "0x607312a5C671D0C511998171e634DE32156e69d0"
const hUSDT = "0x103f2CA2148B863942397dbc50a425cc4f4E9A27"
const hAAVE = "0x30a026Ae9e2A1363E96a5e5Ab12786a46066bEB8"
const hMATIC = "0xEbd7f3349AbA8bB15b897e03D6c1a4Ba95B55e31"
const hLINK = "0x5B9451B1bFAE2A74D7b9D0D45BdD0E9a27F7bB22"
const hKNC = "0x36208A6D429b056BE6bE5fa81CdF4092748ac35D"

const hTokens = [hDAI, hETH, hWBTC, hUSDC, hUSDT, hAAVE, hMATIC, hLINK, hKNC]
const newHTokens = [hDAI, hETH, hWBTC, hUSDC, hUSDT, hMATIC]


contract('BAMM', async accounts => {
  describe("Delister", async () => {

    before(async () => {
      gasPriceInWei = await web3.eth.getGasPrice()
    })

    beforeEach(async () => {
    })

    it.only("Delist", async () => {
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [comptrollerOwner], 
      })
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [adminOwner], 
      })


      const oldAdmins = {}
      console.log("comptroller call transfer bamm ownership")
      for(const bamm of bamms) {
        const bammContract = await HundredBAMM.at(bamm)
        const bammAdmin = await bammContract.owner()
        console.log({bamm}, {bammAdmin})

        oldAdmins[bamm] = bammAdmin

        const admin = await Admin.at(bammAdmin)
        console.log("calling set pending ownership")
        await admin.setBAMMPendingOwnership(delisterAddress, {from: comptrollerOwner})
        console.log("move owner of admin to be delister")
        await admin.transferOwnership(delisterAddress, {from: adminOwner})
        console.log("done")
      }

      console.log("move time forward by two weeks")
      await network.provider.send("evm_increaseTime", [60*60*24*14 + 1])
      console.log("done")

      console.log("execute")
      const delisterContract = await DesliterAdmin.at(delisterAddress)
      await delisterContract.execute()

      for(const bamm of bamms) {
        console.log("check that old admin was restored")
        const bammContract = await HundredBAMM.at(bamm)
        const bammAdmin = await bammContract.owner()
        assert.equal(bammAdmin, oldAdmins[bamm], "invalid bamm admin")

        const admin = await Admin.at(bammAdmin)
        console.log("check admin ownership was restored")
        assert.equal(adminOwner, await admin.owner())

        console.log("check collaterals")
        const collaterals = []
        const collateralCount = await bammContract.collateralCount()
        const currentToken = await bammContract.LUSD()
        const expectedHTokens = newHTokens.filter(e => e !== currentToken);
        assert.equal(collateralCount.toString(), expectedHTokens.length.toString(), "unexpected colllateral count")

        for(let i = 0 ; i < Number(collateralCount.toString()) ; i++) {
          const collateral = await bammContract.collaterals(i)
          collaterals.push(collateral)
          console.log({collateral})
        }

        assert.equal(collaterals.toString(), expectedHTokens.toString(), "unexpected collaterals")
      }      

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