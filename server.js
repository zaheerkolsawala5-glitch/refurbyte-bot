// =========================================================
// Refurbyte WhatsApp Chatbot — Node.js + Express
// Author: Z (Founder, Refurbyte)
// Version: 1.0.0 — Production Build
// =========================================================

import express from "express";
import axios from "axios";
import rateLimit from "express-rate-limit";

// === CONFIG ===
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// === RATE LIMITING (protect against spam/flooding) ===
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // limit each IP to 20 requests/min
});
app.use(limiter);

// === ENV VARIABLES ===
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "refurbyte_verify";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

// === HEALTH CHECK ===
app.get("/healthz", (req, res) => {
  res.status(200).send("✅ Refurbyte chatbot active and online");
});

// === WEBHOOK VERIFICATION (Meta setup) ===
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("✅ Webhook verified with Meta");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// === WEBHOOK MESSAGE HANDLER ===
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    if (body.object) {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const message = changes?.value?.messages?.[0];

      if (message && message.type === "text") {
        const from = message.from;
        const msgBody = message.text.body.trim().toLowerCase();

        console.log(`💬 Message from ${from}: ${msgBody}`);

        if (msgBody.includes("menu")) {
          await sendMenu(from);
        } else if (msgBody.includes("1")) {
          await sendSubmenu(from, "Refurbished PCs", [
            "💻 Budget Office PCs from £120",
            "🎮 Mid-range Gaming PCs from £350",
            "⚡ High-end Builds from £700+",
            "",
            "Reply 'menu' to return."
          ]);
        } else if (msgBody.includes("2")) {
          await sendSubmenu(from, "PC Repairs & Diagnostics", [
            "🧠 Full System Diagnostics - £25",
            "🔧 Repairs (quote after inspection)",
            "💨 Cleaning & Maintenance - from £20",
            "",
            "Reply 'menu' to return."
          ]);
        } else if (msgBody.includes("3")) {
          await sendSubmenu(from, "Hardware Upgrades", [
            "🪛 RAM / SSD Upgrades",
            "🔋 PSU / GPU Replacement",
            "📈 Performance Optimization",
            "",
            "Reply 'menu' to return."
          ]);
        } else if (msgBody.includes("4")) {
          await sendSubmenu(from, "Custom Gaming Builds", [
            "🎮 Custom Spec Consultation - Free",
            "🧩 Budget to Performance Optimized",
            "🚀 Delivery & Setup Options",
            "",
            "Reply 'menu' to return."
          ]);
        } else if (msgBody.includes("5")) {
          await sendSubmenu(from, "Trade-In / Recycle", [
            "♻️ Trade your old PC for credit",
            "🖥️ Free eco-friendly disposal",
            "",
            "Reply 'menu' to return."
          ]);
        } else if (msgBody.includes("6")) {
          await sendSubmenu(from, "Contact & Support", [
            "📞 WhatsApp us anytime",
            "📧 support@refurbyte.com",
            "📍 Leicester, UK",
            "",
            "Reply 'menu' to return."
          ]);
        } else {
          await sendMessage(from, "👋 Welcome to Refurbyte! Type *menu* to get started.");
        }
      }

      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error("❌ Error handling webhook:", error);
    res.sendStatus(500);
  }
});

// === MENU FUNCTIONS ===
async function sendMenu(to) {
  const text = [
    "📋 *Refurbyte Main Menu*",
    "",
    "1️⃣ Refurbished PCs",
    "2️⃣ PC Repairs & Diagnostics",
    "3️⃣ Hardware Upgrades",
    "4️⃣ Custom Gaming Builds",
    "5️⃣ Trade-In or Recycle",
    "6️⃣ Contact & Support",
    "",
    "Reply with a number (1-6) to explore a service."
  ].join("\n");
  await sendMessage(to, text);
}

async function sendSubmenu(to, title, lines) {
  const text = [`📂 *${title}*`, "", ...lines].join("\n");
  await sendMessage(to, text);
}

// === WHATSAPP MESSAGE DISPATCH ===
async function sendMessage(to, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v17.0/${META_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${META_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("❌ Message send error:", err.response?.data || err.message);
  }
}

// === START SERVER ===
app.get('/', (req, res) => {
  res.send('✅ Refurbyte Bot Server is Live and Connected');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Refurbyte bot running on port ${PORT}`));

