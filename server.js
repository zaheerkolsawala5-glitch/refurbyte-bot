// server.js
import express from "express";
import axios from "axios";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { initDB } from "./database.js";
import { backupDB } from "./githubBackup.js";

dotenv.config();

const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve dashboard
app.use(express.static(path.join(__dirname, "public")));

// === RATE LIMITING ===
const limiter = rateLimit({ windowMs: 60*1000, max: 20 });
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
app.get("/healthz", (req,res) => res.status(200).send("✅ Refurbyte chatbot active and online"));

// === API FOR DASHBOARD ===
app.get("/api/users", async (req,res) => {
  if (!db) return res.json([]);
  try {
    const users = await db.all("SELECT id, last_message, last_service, last_interaction FROM users ORDER BY last_interaction DESC");
    res.json(users);
  } catch (err) {
    console.error("❌ Error fetching users:", err);
    res.status(500).json([]);
  }
});

// === DEFAULT ROOT ROUTE ===
app.get("/", (req,res) => res.send("✅ Refurbyte Bot Server is Live and Connected"));

// === WEBHOOK VERIFICATION ===
app.get("/webhook", (req,res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("✅ Webhook verified with Meta");
      res.status(200).send(challenge);
    } else res.sendStatus(403);
  }
});

// === WEBHOOK MESSAGE HANDLER ===
app.post("/webhook", async (req,res) => {
  try {
    const body = req.body;
    if (!body.object) return res.sendStatus(404);

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];
    if (!message || message.type !== "text") return res.sendStatus(200);

    const from = message.from;
    const msgBody = message.text.body.trim().toLowerCase();
    console.log(`💬 Message from ${from}: ${msgBody}`);

    if (db) {
      await db.run(`
        INSERT INTO users (id, last_message)
        VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET last_message=excluded.last_message, last_interaction=CURRENT_TIMESTAMP
      `, [from, message.text.body]);
    }

    let selectedService = null;
    if (msgBody.includes("1")) selectedService="Refurbished PCs";
    else if (msgBody.includes("2")) selectedService="PC Repairs & Diagnostics";
    else if (msgBody.includes("3")) selectedService="Hardware Upgrades";
    else if (msgBody.includes("4")) selectedService="Custom Gaming Builds";
    else if (msgBody.includes("5")) selectedService="Trade-In / Recycle";
    else if (msgBody.includes("6")) selectedService="Contact & Support";

    if (db && selectedService) {
      await db.run(`UPDATE users SET last_service=?, last_interaction=CURRENT_TIMESTAMP WHERE id=?`, [selectedService, from]);
    }

    if (msgBody.includes("menu")) await sendMenu(from);
    else if (selectedService) {
      switch(selectedService){
        case "Refurbished PCs":
          await sendSubmenu(from, selectedService, ["💻 Budget Office PCs from £120","🎮 Mid-range Gaming PCs from £350","⚡ High-end Builds from £700+","","Reply 'menu' to return."]);
          break;
        case "PC Repairs & Diagnostics":
          await sendSubmenu(from, selectedService, ["🧠 Full System Diagnostics - £25","🔧 Repairs (quote after inspection)","💨
