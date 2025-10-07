// githubBackup.js
import fs from "fs";
import path from "path";
import { exec } from "child_process";

const MAX_BACKUPS = 5;

export function backupDB() {
  const src = path.resolve("./refurbyte.db");
  if (!fs.existsSync(src)) {
    console.log("⚠️ No database file found to backup");
    return;
  }

  const backupFolder = path.resolve("./backups");
  if (!fs.existsSync(backupFolder)) fs.mkdirSync(backupFolder);

  const dest = path.join(backupFolder, `refurbyte_${Date.now()}.db`);
  fs.copyFileSync(src, dest);
  console.log(`💾 Database backed up locally: ${dest}`);

  // Cleanup old backups
  const files = fs.readdirSync(backupFolder)
    .filter(f => f.endsWith(".db"))
    .map(f => ({ name: f, time: fs.statSync(path.join(backupFolder, f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time);

  for (let i = MAX_BACKUPS; i < files.length; i++) {
    fs.unlinkSync(path.join(backupFolder, files[i].name));
    console.log(`🗑️ Deleted old backup: ${files[i].name}`);
  }

  // Commit and push to GitHub
  exec(`
    git add backups/*
    git commit -m "Auto-backup: ${new Date().toISOString()}"
    git push origin main
  `, (err, stdout, stderr) => {
    if (err) console.error("❌ GitHub push error:", err.message);
    else console.log("✅ Backup pushed to GitHub");
  });
}
