const AWS = require('aws-sdk')
const s3 = new AWS.S3()

const BUCKET_NAME = 'bp-liquidator'

const uploadJsonFile = (jsonString, fileName) => {
  console.log("========================uploadJsonFile")
  return new Promise((resolve, reject) => {
     // Read content from the file
     
    // Setting up S3 upload parameters
    const params = {
        Bucket: BUCKET_NAME,
        Key: fileName, // File name you want to save as in S3
        Body: jsonString,
        ACL: 'public-read'
    };

    console.log(params)

    // Uploading files to the bucket
    s3.upload(params, function(err, data) {
        if (err) {
            reject(err)
            return
        }
        console.log(`File uploaded successfully.`);
        resolve(data)
    });

  })
}


module.exports = {
  uploadJsonFile
}