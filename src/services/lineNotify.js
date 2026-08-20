const https = require("https");

const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

/**
 * Push a text message to a LINE user.
 * @param {string} lineUserId - The recipient's LINE user ID (Uxxxxxxxx...)
 * @param {string} message - Text content to send
 */
async function pushMessage(lineUserId, message) {
  const body = JSON.stringify({
    to: lineUserId,
    messages: [{ type: "text", text: message }],
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      LINE_PUSH_URL,
      {
        method: "POST",
        timeout: 5000,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`LINE API error ${res.statusCode}: ${data}`));
          }
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("LINE API request timeout"));
    });
    req.write(body);
    req.end();
  });
}

const PAYMENT_LABEL = {
  cash: "現金",
  linepay: "LINE Pay",
  bank: "銀行轉帳",
  card: "信用卡",
};

function formatTime(t) {
  return t ? String(t).substring(0, 5) : "未指定";
}

function formatDateTime(dt) {
  if (!dt) return "-";
  const d = new Date(dt);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Build the order notification message for shop owners.
 */
function buildOrderNotification(order) {
  const lines = [
    `🔔 新訂單通知`,
    `取貨日：${order.schedule_date ?? "-"}`,
    `訂單編號：${order.order_no}`,
    ``,
    `下單時間：${formatDateTime(order.created_at)}`,
    `顧客姓名：${order.customer_name}`,
    `顧客電話：${order.customer_phone}`,
    `取件時間：${formatTime(order.pickup_time)}`,
    `付款方式：${PAYMENT_LABEL[order.payment_method] ?? order.payment_method ?? "-"}`,
    `總金額：NT$ ${order.total_amount}`,
  ];

  if (Array.isArray(order.items) && order.items.length > 0) {
    lines.push(``);
    lines.push(`產品清單：`);
    for (const item of order.items) {
      const sliceNote = item.is_sliced ? "（切片）" : "";
      lines.push(`・${item.product_name} × ${item.quantity}${sliceNote}`);
    }
  }

  if (order.note) {
    lines.push(``);
    lines.push(`備註：${order.note}`);
  }

  return lines.join("\n");
}

module.exports = { pushMessage, buildOrderNotification };
