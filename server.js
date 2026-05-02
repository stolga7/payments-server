const express = require("express");
const axios = require("axios");
const cors = require("cors");
const crypto = require("crypto");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// 🔐 ENV VARIABLES
const API_KEY = process.env.PLISIO_API_KEY;
const WEBHOOK_SECRET = process.env.PLISIO_WEBHOOK_SECRET;
const SERVER_URL = process.env.SERVER_URL;
const APP_URL = process.env.APP_URL;

// 🟢 اختبار السيرفر
app.get("/", (req, res) => {
  res.json({
    status: "Server running",
    message: "API is working 🚀",
    timestamp: new Date().toISOString()
  });
});

// 🟢 إنشاء فاتورة دفع
app.post("/api/create-invoice", async (req, res) => {
  try {
    const { userId, amount, packageName, coins } = req.body;

    if (!API_KEY) {
      return res.status(500).json({ error: "Missing PLISIO_API_KEY" });
    }

    const orderId = "ORD_" + Date.now() + "_" + userId;

    const response = await axios.get(
      "https://plisio.net/api/v1/invoices/new",
      {
        params: {
          api_key: API_KEY,
          amount: amount,
          currency: "USD",
          source_currency: "USDT",
          order_number: orderId,
          callback_url: `${SERVER_URL}/api/webhook`,
          success_url: `${APP_URL}/success`,
          cancel_url: `${APP_URL}/cancel`
        }
      }
    );

    return res.json({
      success: true,
      paymentUrl: response.data.data.invoice_url,
      orderId: orderId
    });

  } catch (err) {
    console.error("Create invoice error:", err.response?.data || err.message);

    return res.status(500).json({
      success: false,
      error: "Failed to create invoice",
      details: err.message
    });
  }
});

// 🟢 Webhook (تأكيد الدفع)
app.post("/api/webhook", async (req, res) => {
  try {
    const payment = req.body;

    console.log("Webhook received:", payment);

    // 🔐 التحقق من التوقيع (اختياري)
    if (WEBHOOK_SECRET && req.headers["x-plisio-signature"]) {
      const signature = req.headers["x-plisio-signature"];

      const expected = crypto
        .createHmac("sha512", WEBHOOK_SECRET)
        .update(JSON.stringify(payment))
        .digest("hex");

      if (signature !== expected) {
        console.log("Invalid signature");
        return res.status(401).send("Invalid signature");
      }
    }

    // 🟡 التأكد من الدفع
    if (!["completed", "confirmed"].includes(payment.status)) {
      return res.sendStatus(200);
    }

    const orderId = payment.order_number;

    // 🟢 استخراج userId
    const userId = orderId.split("_")[2];

    // 🟢 حساب العملات
    const coins = parseFloat(payment.amount) * 100;

    console.log(`User ${userId} gets ${coins} coins`);

    // TODO: هنا تربط قاعدة البيانات (Firestore أو غيره)

    return res.sendStatus(200);

  } catch (err) {
    console.error("Webhook error:", err.message);
    return res.status(500).send("Webhook error");
  }
});

// 🟢 تشغيل السيرفر
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});    );

    // حفظ الطلب في قاعدة البيانات (لاحقاً)
    console.log("Order created:", orderId);

    res.json({
      success: true,
      paymentUrl: response.data.data.invoice_url,
      orderId: orderId,
      invoiceData: response.data.data
    });

  } catch (err) {
    console.error("Error creating invoice:", err.message);    res.status(500).json({ 
      error: "Failed to create invoice",
      details: err.message 
    });
  }
});

// 🟢 Webhook لاستلام تأكيد الدفع
app.post("/api/webhook", async (req, res) => {
  try {
    const payment = req.body;
    
    console.log("Webhook received:", payment);

    // 1. التحقق من التوقيع (إذا متوفر)
    if (WEBHOOK_SECRET) {
      const signature = req.headers['x-plisio-signature'];
      const expectedSig = crypto
        .createHmac("sha512", WEBHOOK_SECRET)
        .update(JSON.stringify(payment))
        .digest("hex");
      
      if (signature !== expectedSig) {
        console.error("Invalid signature");
        return res.status(401).send("Invalid signature");
      }
    }

    // 2. التحقق من حالة الدفع
    if (payment.status !== "completed" && payment.status !== "confirmed") {
      console.log("Payment not completed yet:", payment.status);
      return res.sendStatus(200);
    }

    // 3. منع المعالجة المكررة
    const orderId = payment.order_number;
    const exists = await checkIfProcessed(orderId);
    if (exists) {
      console.log("Order already processed:", orderId);
      return res.sendStatus(200);
    }

    // 4. إضافة العملات للمستخدم
    const userId = extractUserId(orderId);
    const coinsAmount = parseFloat(payment.amount) * 100; // مثال: 1$ = 100 coins
    
    await addUserCoins(userId, coinsAmount);
    
    // 5. تسجيل المعاملة
    await logTransaction({      orderId,
      userId,
      coins: coinsAmount,
      amount: payment.amount,
      currency: payment.currency,
      txHash: payment.transaction_hash,
      timestamp: new Date()
    });

    console.log("Payment processed successfully:", orderId);

    // 6. إرسال إشعار للتطبيق (اختياري)
    // await sendNotification(userId, "Payment successful!");

    res.sendStatus(200);

  } catch (err) {
    console.error("Webhook error:", err.message);
    res.status(500).send("Webhook error");
  }
});

// دوال مساعدة (تحتاج تطبيقها مع قاعدة البيانات)
async function checkIfProcessed(orderId) {
  // TODO: ابحث في قاعدة البيانات
  return false; // مؤقتاً
}

function extractUserId(orderId) {
  // TODO: استخرج userId من orderId
  return orderId.split("_")[2];
}

async function addUserCoins(userId, coins) {
  // TODO: أضف العملات لرصيد المستخدم في Firestore
  console.log(`Adding ${coins} coins to user ${userId}`);
}

async function logTransaction(data) {
  // TODO: سجل المعاملة في Firestore
  console.log("Transaction logged:", data);
}

// اختبار السيرفر
app.get("/", (req, res) => {
  res.json({ 
    status: "Server running",
    timestamp: new Date().toISOString()
  });
});
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => {
  res.json({
    status: "Server running",
    message: "API is working 🚀"
  });
});
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
