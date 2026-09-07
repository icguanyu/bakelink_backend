const { Storage } = require("@google-cloud/storage");
const { gcs } = require("../config");

let storageClient = null;
let bucketRef = null;

// 本機開發：需要先跑過 `gcloud auth application-default login`
// Cloud Run 上：自動用服務所綁定的 Service Account 授權，不需要任何金鑰檔
function getBucket() {
  if (bucketRef) {
    return bucketRef;
  }

  if (!gcs.bucketName) {
    return null;
  }

  storageClient = storageClient || new Storage();
  bucketRef = storageClient.bucket(gcs.bucketName);
  return bucketRef;
}

function publicUrlFor(objectPath) {
  return `https://storage.googleapis.com/${gcs.bucketName}/${objectPath}`;
}

module.exports = { getBucket, publicUrlFor };
