'use strict';
const {runOnLambda} = require('./liquidator')
const {runOnLambda: runOnLambdaPolygon} = require('./liquidator_generic')
const {runBKeeper} = require('./bKeeper')

module.exports.liquidate = async (event) => {
  try{
  await runOnLambda()
  return {
      statusCode: 200,
      body: JSON.stringify(
        {
          message: 'liquidator runOnLambda executed successfully!',
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

module.exports.liquidate_polygon = async (event) => {
  try{
  await runOnLambdaPolygon()
  return {
      statusCode: 200,
      body: JSON.stringify(
        {
          message: 'liquidator runOnLambdaPolygon executed successfully!',
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

module.exports.bKeeper = async (event) => {
  try{
  await runBKeeper()
  return {
      statusCode: 200,
      body: JSON.stringify(
        {
          message: 'bKeeper run executed successfully!',
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
