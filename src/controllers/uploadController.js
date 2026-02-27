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

function resolveUploadedFileMeta(file) {
  if (!file) {
    return { error: "file is required in form-data" };
  }
  if (!file.size || file.size <= 0) {
    return { error: "file must not be empty" };
  }
  if (!file.mimetype || !file.mimetype.startsWith(upload.allowedMimePrefix)) {
    return { error: "Only image files are allowed" };
  }

  const ext = resolveSafeExtension(file.originalname, file.mimetype);
  return { value: { ext } };
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
    const meta = resolveUploadedFileMeta(file);
    if (meta.error) {
      return res.status(400).json({ message: meta.error });
    }

    const { ext } = meta.value;
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

async function uploadAvatar(req, res) {
  if (!supabase.storageBucket) {
    return res.status(500).json({ message: "SUPABASE_STORAGE_BUCKET is not configured" });
  }

  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    return res.status(500).json({ message: "Supabase client is not configured" });
  }

  const client = await pool.connect();
  let uploadedObjectPath = null;
  try {
    const userResult = await client.query(
      `SELECT avatar, avatar_object_path
       FROM users
       WHERE id = $1`,
      [req.user.sub],
    );

    if (!userResult.rows[0]) {
      client.release();
      return res.status(404).json({ message: "User not found" });
    }

    const previousAvatarUrl = userResult.rows[0].avatar || null;
    const previousObjectPath = userResult.rows[0].avatar_object_path || null;

    const file = req.file;
    const meta = resolveUploadedFileMeta(file);
    if (meta.error) {
      client.release();
      return res.status(400).json({ message: meta.error });
    }

    const { ext } = meta.value;
    const randomPart = crypto.randomBytes(8).toString("hex");
    const objectPath = `${req.user.sub}/avatar-${Date.now()}-${randomPart}${ext}`;
    uploadedObjectPath = objectPath;

    const { error: uploadError } = await supabaseClient.storage
      .from(supabase.storageBucket)
      .upload(objectPath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      client.release();
      return res.status(502).json({ message: "Failed to upload avatar to storage", error: uploadError.message });
    }

    const { data: publicUrlData } = supabaseClient.storage
      .from(supabase.storageBucket)
      .getPublicUrl(objectPath);

    const publicUrl = publicUrlData?.publicUrl || null;
    if (!publicUrl) {
      client.release();
      return res.status(502).json({ message: "Failed to resolve uploaded avatar URL" });
    }

    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE users
         SET avatar = $1, avatar_object_path = $2, updated_at = NOW()
         WHERE id = $3`,
        [publicUrl, objectPath, req.user.sub],
      );

      await client.query(
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
      await client.query("COMMIT");
    } catch (dbError) {
      await client.query("ROLLBACK");
      const { error: cleanupError } = await supabaseClient.storage
        .from(supabase.storageBucket)
        .remove([objectPath]);
      if (cleanupError) {
        console.error("Failed to cleanup avatar after DB error:", cleanupError.message);
      }
      throw dbError;
    } finally {
      client.release();
    }

    if (previousObjectPath && previousObjectPath !== objectPath) {
      const { error: removeError } = await supabaseClient.storage
        .from(supabase.storageBucket)
        .remove([previousObjectPath]);
      if (!removeError) {
        await pool.query(
          `DELETE FROM uploaded_files
           WHERE user_id = $1 AND bucket = $2 AND object_path = $3`,
          [req.user.sub, supabase.storageBucket, previousObjectPath],
        );
      }
    } else if (previousAvatarUrl && previousAvatarUrl !== publicUrl) {
      await pool.query(
        `DELETE FROM uploaded_files
         WHERE user_id = $1 AND bucket = $2 AND public_url = $3`,
        [req.user.sub, supabase.storageBucket, previousAvatarUrl],
      );
    }

    return res.status(201).json({ url: publicUrl });
  } catch (error) {
    if (uploadedObjectPath) {
      const { error: cleanupError } = await supabaseClient.storage
        .from(supabase.storageBucket)
        .remove([uploadedObjectPath]);
      if (cleanupError) {
        console.error("Failed to cleanup avatar:", cleanupError.message);
      }
    }
    console.error("POST /UploadAvatar error:", error.message);
    return res.status(500).json({ message: "Failed to upload avatar", error: error.message });
  }
}

module.exports = { uploadFile, uploadAvatar };
