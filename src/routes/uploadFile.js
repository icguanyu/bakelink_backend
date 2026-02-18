const express = require("express");
const multer = require("multer");
const { authRequired } = require("../middleware/auth");
const { upload } = require("../config");
const { uploadFile } = require("../controllers/uploadController");

const router = express.Router();

const multerMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: upload.maxFileSizeBytes },
});

router.post("/", authRequired, (req, res, next) => {
  multerMiddleware.single("file")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ message: `File is too large. Max size is ${upload.maxFileSizeBytes} bytes` });
    }

    return res.status(400).json({ message: error.message || "Invalid upload payload" });
  });
}, uploadFile);

module.exports = router;
