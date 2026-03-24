const express = require("express");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const crypto = require("crypto");
let router = express.Router();
const pino = require("pino");
const QRCode = require("qrcode");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
  jidNormalizedUser,
} = require("@whiskeysockets/baileys");
const { upload } = require("./mega");

function removeFile(FilePath) {
  if (!fs.existsSync(FilePath)) return false;
  try {
    fs.rmSync(FilePath, { recursive: true, force: true });
    console.log(`[CLEANUP] Removed: ${FilePath}`);
    return true;
  } catch (err) {
    console.error(`[CLEANUP ERROR] ${FilePath}:`, err);
    return false;
  }
}

router.get("/qr", async (req, res) => {
  const id = crypto.randomBytes(8).toString("hex");
  const sessionPath = path.resolve(process.cwd(), "temp_sessions", `session-${id}`);

  console.log(`[QR] Starting new session: ${id}`);

  if (!fs.existsSync(path.dirname(sessionPath))) {
    fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  }

  async function GetQR() {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      let RobinQR = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(
            state.keys,
            pino({ level: "fatal" }).child({ level: "fatal" })
          ),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }).child({ level: "fatal" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
      });

      RobinQR.ev.on("creds.update", saveCreds);

      RobinQR.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect, qr } = s;

        if (qr && !res.headersSent) {
          try {
            const qrDataUrl = await QRCode.toDataURL(qr);
            res.send({ qr: qrDataUrl });
          } catch (err) {
            console.error("[QR ERROR]", err);
          }
        }

        if (connection === "open") {
          console.log(`[QR SUCCESS] ${id}`);
          try {
            await delay(10000);
            const user_jid = jidNormalizedUser(RobinQR.user.id);
            const credsPath = path.join(sessionPath, "creds.json");

            if (fs.existsSync(credsPath)) {
                const mega_url = await upload(fs.createReadStream(credsPath), `${id}.json`);
                const string_session = mega_url.replace("https://mega.nz/file/", "");
                const sid = `*ROBIN SESSION*\n\n👉 ${string_session} 👈`;
                await RobinQR.sendMessage(user_jid, { text: sid });
                await RobinQR.sendMessage(user_jid, { text: string_session });
            }
            await delay(5000);
            removeFile(sessionPath);
          } catch (e) {
            console.error("[QR PROC ERROR]", e);
            removeFile(sessionPath);
          }
        } else if (connection === "close") {
          const reason = lastDisconnect?.error?.output?.statusCode;
          if (reason === 401) removeFile(sessionPath);
        }
      });
    } catch (err) {
      console.error("[QR GLOBAL ERROR]", err);
      removeFile(sessionPath);
      if (!res.headersSent) res.send({ qr: "Error" });
    }
  }
  GetQR();
});

router.get("/", async (req, res) => {
  let num = req.query.number;
  if (!num) return res.send({ code: "Number Required" });

  const id = crypto.randomBytes(8).toString("hex");
  const sessionPath = path.resolve(process.cwd(), "temp_sessions", `session-${id}`);

  console.log(`[PAIR] Starting for ${num} (ID: ${id})`);

  if (!fs.existsSync(path.dirname(sessionPath))) {
    fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  }

  async function RobinPair() {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      let RobinPairWeb = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(
            state.keys,
            pino({ level: "fatal" }).child({ level: "fatal" })
          ),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }).child({ level: "fatal" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
      });

      RobinPairWeb.ev.on("creds.update", saveCreds);
      
      RobinPairWeb.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection === "open") {
          console.log(`[PAIR SUCCESS] ${num}`);
          try {
            await delay(10000);
            const user_jid = jidNormalizedUser(RobinPairWeb.user.id);
            const credsPath = path.join(sessionPath, "creds.json");
            if (fs.existsSync(credsPath)) {
                const mega_url = await upload(fs.createReadStream(credsPath), `${id}.json`);
                const string_session = mega_url.replace("https://mega.nz/file/", "");
                await RobinPairWeb.sendMessage(user_jid, { text: string_session });
            }
            await delay(5000);
            removeFile(sessionPath);
          } catch (e) {
            console.error("[PAIR PROC ERROR]", e);
            removeFile(sessionPath);
          }
        } else if (connection === "close") {
           const reason = lastDisconnect?.error?.output?.statusCode;
           if (reason === 401) removeFile(sessionPath);
        }
      });

      // Wait for registration state
      await delay(3000);
      if (!RobinPairWeb.authState.creds.registered) {
          num = num.replace(/[^0-9]/g, "");
          try {
              const code = await RobinPairWeb.requestPairingCode(num);
              if (!res.headersSent) res.send({ code });
          } catch (codeErr) {
              console.error("[PAIRING CODE ERROR]", codeErr);
              if (!res.headersSent) res.send({ code: "Error: " + (codeErr.message || "Connection Closed") });
          }
      } else {
          if (!res.headersSent) res.send({ code: "Already Registered" });
      }

    } catch (err) {
      console.error("[PAIR GLOBAL ERROR]", err);
      removeFile(sessionPath);
      if (!res.headersSent) res.send({ code: "Service Error" });
    }
  }
  RobinPair();
});

module.exports = router;
