const {run} = require('./liquidator')

const init = async ()=>{ 
  await run()
  setTimeout(init, 1000 * 10 * 60); 
  console.log("sleeping for 10 minute")
}

init()
