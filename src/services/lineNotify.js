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
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/**
 * Build the order notification message for shop owners.
 */
function buildOrderNotification(order) {
  const lines = [
    `🔔 新訂單通知`,
    `訂單編號：${order.order_no}`,
    `顧客姓名：${order.customer_name}`,
    `顧客電話：${order.customer_phone}`,
    `取件時間：${order.pickup_time ?? "未指定"}`,
    `付款方式：${order.payment_method ?? "-"}`,
    `總金額：NT$ ${order.total_amount}`,
  ];

  if (order.note) lines.push(`備註：${order.note}`);

  return lines.join("\n");
}

module.exports = { pushMessage, buildOrderNotification };
