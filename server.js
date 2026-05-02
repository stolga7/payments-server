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

// 🟢 Health Check
app.get("/", (req, res) => {
  res.json({
    status: "Server running",
    message: "API is working 🚀",
    timestamp: new Date().toISOString()
  });
});

// 🟢 Create Payment Invoice
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

// 🟢 Webhook - Payment Confirmation
app.post("/api/webhook", async (req, res) => {
  try {
    const payment = req.body;

    console.log("Webhook received:", payment);

    // 🔐 Verify Signature (optional)
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

    // 🟡 Verify Payment Status
    if (!["completed", "confirmed"].includes(payment.status)) {
      return res.sendStatus(200);
    }

    const orderId = payment.order_number;

    // 🟢 Extract userId
    const userId = orderId.split("_")[2];

    // 🟢 Calculate Coins
    const coins = parseFloat(payment.amount) * 100;

    console.log(`User ${userId} gets ${coins} coins`);

    // TODO: Connect to Database (Firestore or other)
    // - Check if order already processed
    // - Add coins to user balance
    // - Log transaction

    return res.sendStatus(200);

  } catch (err) {
    console.error("Webhook error:", err.message);
    return res.status(500).send("Webhook error");
  }
});

// 🟢 Start Server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
