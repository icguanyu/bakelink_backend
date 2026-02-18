const path = require("path");
const crypto = require("crypto");
const { pool } = require("../db");
const { upload, supabase } = require("../config");
const { getSupabaseClient } = require("../utils/supabase");

function resolveSafeExtension(fileName = "", mimeType = "") {
  const ext = path.extname(fileName).toLowerCase();
  if (ext && /^[.][a-z0-9]+$/.test(ext)) {
    return ext;
  }

  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/gif") return ".gif";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/svg+xml") return ".svg";
  return "";
}

async function uploadFile(req, res) {
  try {
    if (!supabase.storageBucket) {
      return res.status(500).json({ message: "SUPABASE_STORAGE_BUCKET is not configured" });
    }

    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      return res.status(500).json({ message: "Supabase client is not configured" });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "file is required in form-data" });
    }
    if (!file.size || file.size <= 0) {
      return res.status(400).json({ message: "file must not be empty" });
    }

    if (!file.mimetype || !file.mimetype.startsWith(upload.allowedMimePrefix)) {
      return res.status(400).json({ message: "Only image files are allowed" });
    }

    const ext = resolveSafeExtension(file.originalname, file.mimetype);
    const randomPart = crypto.randomBytes(8).toString("hex");
    const objectPath = `${req.user.sub}/${Date.now()}-${randomPart}${ext}`;

    const { error: uploadError } = await supabaseClient.storage
      .from(supabase.storageBucket)
      .upload(objectPath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      return res.status(502).json({ message: "Failed to upload file to storage", error: uploadError.message });
    }

    const { data: publicUrlData } = supabaseClient.storage
      .from(supabase.storageBucket)
      .getPublicUrl(objectPath);

    const publicUrl = publicUrlData?.publicUrl || null;
    if (!publicUrl) {
      return res.status(502).json({ message: "Failed to resolve uploaded file URL" });
    }

    await pool.query(
      `INSERT INTO uploaded_files (
         user_id, bucket, object_path, public_url, original_name, mime_type, size_bytes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        req.user.sub,
        supabase.storageBucket,
        objectPath,
        publicUrl,
        file.originalname || "",
        file.mimetype || "",
        file.size || 0,
      ],
    );

    return res.status(201).json({ url: publicUrl });
  } catch (error) {
    console.error("POST /UploadFile error:", error.message);
    return res.status(500).json({ message: "Failed to upload file", error: error.message });
  }
}

module.exports = { uploadFile };
