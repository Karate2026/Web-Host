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
  Browsers,
  jidNormalizedUser,
} = require("@whiskeysockets/baileys");
const { upload } = require("./mega");

function removeFile(FilePath) {
  if (!fs.existsSync(FilePath)) return false;
  try {
    fs.rmSync(FilePath, { recursive: true, force: true });
    return true;
  } catch (err) {
    console.error(`Error removing ${FilePath}:`, err);
    return false;
  }
}

router.get("/qr", async (req, res) => {
  const id = crypto.randomBytes(8).toString("hex");
  const sessionPath = path.join(process.cwd(), "temp_sessions", `session-${id}`);

  // Create temp directory if it doesn't exist
  if (!fs.existsSync(path.join(process.cwd(), "temp_sessions"))) {
    fs.mkdirSync(path.join(process.cwd(), "temp_sessions"));
  }

  async function GetQR() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    try {
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
            console.error("QR Generation Error:", err);
          }
        }

        if (connection === "open") {
          try {
            await delay(5000);
            if (!RobinQR.user) throw new Error("User not found after connection");
            
            const user_jid = jidNormalizedUser(RobinQR.user.id);
            const credsPath = path.join(sessionPath, "creds.json");

            if (!fs.existsSync(credsPath)) {
               throw new Error("creds.json not found after connection");
            }

            const mega_url = await upload(
              fs.createReadStream(credsPath),
              `${id}.json`
            );

            const string_session = mega_url.replace("https://mega.nz/file/", "");
            const sid = `*ROBIN [The powerful WA BOT]*\n\n👉 ${string_session} 👈\n\n*This is your Session ID, copy this id and paste into config.js file*\n\n*wa.me/message/WKGLBR2PCETWD1*`;
            
            await RobinQR.sendMessage(user_jid, {
              image: {
                url: "https://raw.githubusercontent.com/Dark-Robin/Bot-Helper/refs/heads/main/autoimage/Bot%20robin%20WP.jpg",
              },
              caption: sid,
            });
            await RobinQR.sendMessage(user_jid, { text: string_session });
            
            await delay(2000);
            RobinQR.logout();
            RobinQR.end();
            removeFile(sessionPath);
          } catch (e) {
            console.error("Connection success handling error:", e);
            removeFile(sessionPath);
          }
        } else if (connection === "close") {
          const reason = lastDisconnect?.error?.output?.statusCode;
          if (reason === 401) {
            removeFile(sessionPath);
          }
        }
      });
    } catch (err) {
      console.log("QR Service Error:", err);
      removeFile(sessionPath);
      if (!res.headersSent) {
        res.send({ qr: "Service Unavailable" });
      }
    }
  }
  GetQR();
});

router.get("/", async (req, res) => {
  let num = req.query.number;
  if (!num) return res.send({ code: "Number Required" });

  const id = crypto.randomBytes(8).toString("hex");
  const sessionPath = path.join(process.cwd(), "temp_sessions", `session-${id}`);

  // Create temp directory if it doesn't exist
  if (!fs.existsSync(path.join(process.cwd(), "temp_sessions"))) {
    fs.mkdirSync(path.join(process.cwd(), "temp_sessions"));
  }

  async function RobinPair() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    try {
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

      if (!RobinPairWeb.authState.creds.registered) {
        await delay(1500);
        num = num.replace(/[^0-9]/g, "");
        const code = await RobinPairWeb.requestPairingCode(num);
        if (!res.headersSent) {
          res.send({ code });
        }
      }

      RobinPairWeb.ev.on("creds.update", saveCreds);
      RobinPairWeb.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection === "open") {
          try {
            await delay(5000);
            if (!RobinPairWeb.user) throw new Error("User not found after pairing");

            const user_jid = jidNormalizedUser(RobinPairWeb.user.id);
            const credsPath = path.join(sessionPath, "creds.json");

            if (!fs.existsSync(credsPath)) {
               throw new Error("creds.json not found after pairing");
            }

            const mega_url = await upload(
              fs.createReadStream(credsPath),
              `${id}.json`
            );

            const string_session = mega_url.replace("https://mega.nz/file/", "");
            const sid = `*ROBIN [The powerful WA BOT]*\n\n👉 ${string_session} 👈\n\n*This is your Session ID, copy this id and paste into config.js file*\n\n*wa.me/message/WKGLBR2PCETWD1*`;

            await RobinPairWeb.sendMessage(user_jid, {
              image: {
                url: "https://raw.githubusercontent.com/Dark-Robin/Bot-Helper/refs/heads/main/autoimage/Bot%20robin%20WP.jpg",
              },
              caption: sid,
            });
            await RobinPairWeb.sendMessage(user_jid, { text: string_session });

            await delay(2000);
            RobinPairWeb.logout();
            RobinPairWeb.end();
            removeFile(sessionPath);
          } catch (e) {
            console.error("Pairing success handling error:", e);
            removeFile(sessionPath);
          }
        } else if (connection === "close") {
           const reason = lastDisconnect?.error?.output?.statusCode;
           if (reason === 401) {
             removeFile(sessionPath);
           }
        }
      });
    } catch (err) {
      console.log("Service error:", err);
      removeFile(sessionPath);
      if (!res.headersSent) {
        res.send({ code: "Service Unavailable" });
      }
    }
  }
  RobinPair();
});

process.on("uncaughtException", function (err) {
  console.log("Caught exception: " + err);
});

module.exports = router;
