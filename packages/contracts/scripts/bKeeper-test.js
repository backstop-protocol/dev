// todo transefer 1000 ETH to bamm
const hre = require("hardhat");

const send1000ETH = async () => {

  const to = "0x04208f296039f482810b550ae0d68c3e1a5eb719"
  const from = "0x8e15a22853A0A60a0FBB0d875055A8E66cff0235"
  const value = web3.utils.toWei("1000")
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [from], 
  })
  var send = await web3.eth.sendTransaction({ from, to, value });
  return send
}

const {run} = require("../../liquidator/bKeeper")

const init = async () =>{
  try{
    await send1000ETH()
    let balance = await web3.eth.getBalance("0x04208f296039f482810b550ae0d68c3e1a5eb719"); //Will give value in.
    console.log(balance.toString())
    await run()
    balance = await web3.eth.getBalance("0x04208f296039f482810b550ae0d68c3e1a5eb719"); //Will give value in.
    console.log(balance.toString())
  } catch (err){
    console.error(err)
  }
}

init()