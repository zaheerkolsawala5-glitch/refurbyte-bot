// server.js
import express from "express";
import axios from "axios";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { initDB } from "./database.js";
import { backupDB } from "./githubBackup.js";

dotenv.config();

const app = express();
app.use(express.json());

// === RATE LIMITING ===
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
});
app.use(limiter);

// === ENV VARIABLES ===
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "refurbyte_verify";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

// === DATABASE ===
let db;
initDB().then(database => {
  db = database;
  console.log("✅ Database initialized");
});

// === HEALTH CHECK ===
app.get("/healthz", (req, res) => {
  res.status(200).send("✅ Refurbyte chatbot active and online");
});

// === DEFAULT ROOT ROUTE ===
app.get("/", (req, res) => {
  res.send("✅ Refurbyte Bot Server is Live and Connected");
});

// === WEBHOOK VERIFICATION ===
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

        // --- TRACK USER IN DATABASE ---
        if (db) {
          await db.run(`
            INSERT INTO users (id, last_message)
            VALUES (?, ?)
            ON CONFLICT(id) DO UPDATE SET last_message=excluded.last_message, last_interaction=CURRENT_TIMESTAMP
          `, [from, message.text.body]);
        }

        // --- DETERMINE SELECTED SERVICE ---
        let selectedService = null;
        if (msgBody.includes("1")) selectedService = "Refurbished PCs";
        else if (msgBody.includes("2")) selectedService = "PC Repairs & Diagnostics";
        else if (msgBody.includes("3")) selectedService = "Hardware Upgrades";
        else if (msgBody.includes("4")) selectedService = "Custom Gaming Builds";
        else if (msgBody.includes("5")) selectedService = "Trade-In / Recycle";
        else if (msgBody.includes("6")) selectedService = "Contact & Support";

        // --- SAVE SELECTED SERVICE TO DB ---
        if (db && selectedService) {
          await db.run(`
            UPDATE users
            SET last_service = ?, last_interaction=CURRENT_TIMESTAMP
            WHERE id = ?
          `, [selectedService, from]);
        }

        // --- MENU LOGIC ---
        if (msgBody.includes("menu")) {
          await sendMenu(from);
        } else if (selectedService) {
          switch (selectedService) {
            case "Refurbished PCs":
              await sendSubmenu(from, selectedService, [
                "💻 Budget Office PCs from £120",
                "🎮 Mid-range Gaming PCs from £350",
                "⚡ High-end Builds from £700+",
                "",
                "Reply 'menu' to return."
              ]);
              break;
            case "PC Repairs & Diagnostics":
              await sendSubmenu(from, selectedService, [
                "🧠 Full System Diagnostics - £25",
                "🔧 Repairs (quote after inspection)",
                "💨 Cleaning & Maintenance - from £20",
                "",
                "Reply 'menu' to return."
              ]);
              break;
            case "Hardware Upgrades":
              await sendSubmenu(from, selectedService, [
                "🪛 RAM / SSD Upgrades",
                "🔋 PSU / GPU Replacement",
                "📈 Performance Optimization",
                "",
                "Reply 'menu' to return."
              ]);
              break;
            case "Custom Gaming Builds":
              await sendSubmenu(from, selectedService, [
                "🎮 Custom Spec Consultation - Free",
                "🧩 Budget to Performance Optimized",
                "🚀 Delivery & Setup Options",
                "",
                "Reply 'menu' to return."
              ]);
              break;
            case "Trade-In / Recycle":
              await sendSubmenu(from, selectedService, [
                "♻️ Trade your old PC for credit",
                "🖥️ Free eco-friendly disposal",
                "",
                "Reply 'menu' to return."
              ]);
              break;
            case "Contact & Support":
              await sendSubmenu(from, selectedService, [
                "📞 WhatsApp us anytime",
                "📧 support@refurbyte.com",
                "📍 Leicester, UK",
                "",
                "Reply 'menu' to return."
              ]);
              break;
          }
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
      { messaging_product: "whatsapp", to, text: {
