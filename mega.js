const mega = require("megajs");
const auth = {
  email: "nerodark445@gmail.com",
  password: "Rashmika@2007",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246",
};

const upload = (data, name) => {
  return new Promise((resolve, reject) => {
    console.log(`[MEGA] Initializing upload for ${name}...`);
    const storage = new mega.Storage(auth);

    storage.on("ready", () => {
      console.log("[MEGA] Storage ready. Starting upload...");
      const uploadStream = storage.upload({ name, allowUploadBuffering: true });

      uploadStream.on("complete", (file) => {
        console.log("[MEGA] Upload complete. Generating link...");
        file.link((err, url) => {
          if (err) {
            console.error("[MEGA ERROR] Link generation failed:", err);
            reject(err);
          } else {
            console.log(`[MEGA SUCCESS] File uploaded: ${url}`);
            storage.close();
            resolve(url);
          }
        });
      });

      uploadStream.on("error", (err) => {
        console.error("[MEGA ERROR] Upload stream error:", err);
        reject(err);
      });

      data.pipe(uploadStream);
    });

    storage.on("error", (err) => {
      console.error("[MEGA ERROR] Storage initialization error:", err);
      reject(err);
    });

    // Timeout if storage takes too long
    setTimeout(() => {
        if (storage.status === 'logging in' || storage.status === 'initializing') {
            console.error("[MEGA ERROR] Storage timeout during login/init");
            reject(new Error("Mega storage timeout"));
        }
    }, 30000);
  });
};

module.exports = { upload };
