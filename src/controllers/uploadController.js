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
    return { error: "請在 form-data 中附上檔案" };
  }
  if (!file.size || file.size <= 0) {
    return { error: "上傳的檔案不可為空" };
  }
  if (!file.mimetype || !file.mimetype.startsWith(upload.allowedMimePrefix)) {
    return { error: "僅允許上傳圖片格式的檔案" };
  }

  const ext = resolveSafeExtension(file.originalname, file.mimetype);
  return { value: { ext } };
}

async function uploadFile(req, res) {
  try {
    if (!supabase.storageBucket) {
      return res.status(500).json({ message: "儲存空間未設定，請聯繫系統管理員" });
    }

    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      return res.status(500).json({ message: "儲存服務未設定，請聯繫系統管理員" });
    }

    const file = req.file;
    const meta = resolveUploadedFileMeta(file);
    if (meta.error) {
      return res.status(400).json({ message: meta.error });
    }

    const { ext } = meta.value;
    const randomPart = crypto.randomBytes(8).toString("hex");
    const objectPath = `${req.user.sub}/products/${Date.now()}-${randomPart}${ext}`;

    const { error: uploadError } = await supabaseClient.storage
      .from(supabase.storageBucket)
      .upload(objectPath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      return res.status(502).json({ message: "上傳檔案至儲存空間失敗", error: uploadError.message });
    }

    const { data: publicUrlData } = supabaseClient.storage
      .from(supabase.storageBucket)
      .getPublicUrl(objectPath);

    const publicUrl = publicUrlData?.publicUrl || null;
    if (!publicUrl) {
      return res.status(502).json({ message: "無法取得上傳檔案的網址" });
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
    return res.status(500).json({ message: "上傳檔案失敗", error: error.message });
  }
}

async function uploadAvatar(req, res) {
  if (!supabase.storageBucket) {
    return res.status(500).json({ message: "儲存空間未設定，請聯繫系統管理員" });
  }

  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    return res.status(500).json({ message: "儲存服務未設定，請聯繫系統管理員" });
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
      return res.status(404).json({ message: "找不到使用者" });
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
    const objectPath = `${req.user.sub}/avatars/${Date.now()}-${randomPart}${ext}`;
    uploadedObjectPath = objectPath;

    const { error: uploadError } = await supabaseClient.storage
      .from(supabase.storageBucket)
      .upload(objectPath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      client.release();
      return res.status(502).json({ message: "上傳大頭貼至儲存空間失敗", error: uploadError.message });
    }

    const { data: publicUrlData } = supabaseClient.storage
      .from(supabase.storageBucket)
      .getPublicUrl(objectPath);

    const publicUrl = publicUrlData?.publicUrl || null;
    if (!publicUrl) {
      client.release();
      return res.status(502).json({ message: "無法取得上傳大頭貼的網址" });
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
    return res.status(500).json({ message: "上傳大頭貼失敗", error: error.message });
  }
}

async function uploadCover(req, res) {
  if (!supabase.storageBucket) {
    return res.status(500).json({ message: "儲存空間未設定，請聯繫系統管理員" });
  }

  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    return res.status(500).json({ message: "儲存服務未設定，請聯繫系統管理員" });
  }

  const client = await pool.connect();
  let uploadedObjectPath = null;
  try {
    const userResult = await client.query(
      `SELECT cover, cover_object_path
       FROM users
       WHERE id = $1`,
      [req.user.sub],
    );

    if (!userResult.rows[0]) {
      client.release();
      return res.status(404).json({ message: "找不到使用者" });
    }

    const previousCoverUrl = userResult.rows[0].cover || null;
    const previousObjectPath = userResult.rows[0].cover_object_path || null;

    const file = req.file;
    const meta = resolveUploadedFileMeta(file);
    if (meta.error) {
      client.release();
      return res.status(400).json({ message: meta.error });
    }

    const { ext } = meta.value;
    const randomPart = crypto.randomBytes(8).toString("hex");
    const objectPath = `${req.user.sub}/covers/${Date.now()}-${randomPart}${ext}`;
    uploadedObjectPath = objectPath;

    const { error: uploadError } = await supabaseClient.storage
      .from(supabase.storageBucket)
      .upload(objectPath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      client.release();
      return res.status(502).json({ message: "上傳封面至儲存空間失敗", error: uploadError.message });
    }

    const { data: publicUrlData } = supabaseClient.storage
      .from(supabase.storageBucket)
      .getPublicUrl(objectPath);

    const publicUrl = publicUrlData?.publicUrl || null;
    if (!publicUrl) {
      client.release();
      return res.status(502).json({ message: "無法取得上傳封面的網址" });
    }

    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE users
         SET cover = $1, cover_object_path = $2, updated_at = NOW()
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
        console.error("Failed to cleanup cover after DB error:", cleanupError.message);
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
    } else if (previousCoverUrl && previousCoverUrl !== publicUrl) {
      await pool.query(
        `DELETE FROM uploaded_files
         WHERE user_id = $1 AND bucket = $2 AND public_url = $3`,
        [req.user.sub, supabase.storageBucket, previousCoverUrl],
      );
    }

    return res.status(201).json({ url: publicUrl });
  } catch (error) {
    if (uploadedObjectPath) {
      const { error: cleanupError } = await supabaseClient.storage
        .from(supabase.storageBucket)
        .remove([uploadedObjectPath]);
      if (cleanupError) {
        console.error("Failed to cleanup cover:", cleanupError.message);
      }
    }
    console.error("POST /UploadCover error:", error.message);
    return res.status(500).json({ message: "上傳封面失敗", error: error.message });
  }
}

module.exports = { uploadFile, uploadAvatar, uploadCover };
