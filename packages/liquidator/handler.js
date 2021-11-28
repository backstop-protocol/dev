'use strict';
const {runOnLambda} = require('./liquidator')

module.exports.liquidate = async (event) => {
  try{
  await runOnLambda()
  return {
      statusCode: 200,
      body: JSON.stringify(
        {
          message: 'runOnLambda executed successfully!',
          input: event,
        },
        null,
        2
      ),
    };
  } catch (err){
    console.error(err)
    return {
      statusCode: 500,
      body: JSON.stringify(
        {
          message: err.message,
          input: event,
        },
        null,
        2
      ),
    };
  }
};
