const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const https = require("https");

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

function verifyLineSignature(req) {
  if (!CHANNEL_SECRET) return true;
  const signature = req.headers["x-line-signature"];
  if (!signature) return false;
  const digest = crypto
    .createHmac("sha256", CHANNEL_SECRET)
    .update(req.rawBody ?? JSON.stringify(req.body))
    .digest("base64");
  return digest === signature;
}

function replyMessage(replyToken, text) {
  const body = JSON.stringify({
    replyToken,
    messages: [{ type: "text", text }],
  });
  const req = https.request("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
  });
  req.on("error", (err) => console.error("[LINE reply error]", err.message));
  req.write(body);
  req.end();
}

router.post("/line", (req, res) => {
  if (!verifyLineSignature(req)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const events = req.body.events ?? [];

  for (const event of events) {
    const lineUserId = event.source?.userId;

    if (event.type === "follow") {
      console.log("[LINE webhook] follow, userId:", lineUserId);
    }

    if (event.type === "message" && event.message?.type === "text") {
      const text = event.message.text.trim();
      if (text === "綁定") {
        replyMessage(
          event.replyToken,
          `您的 LINE User ID 為：\n${lineUserId}\n\n請複製此 ID，貼到後台「設定 → 05 通知」進行綁定。`,
        );
      }
    }
  }

  res.status(200).json({ ok: true });
});

module.exports = router;
