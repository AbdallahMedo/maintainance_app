// src/server.js
require("dotenv").config();
const app = require("./app");
const { connectDB, sequelize } = require("./config/db");

console.log("🟢 server.js loaded");

(async () => {
  try {
    console.log("➡️ Step 1: Connecting to DB...");
    await connectDB();
    console.log("➡️ Step 1 done ✅");

    console.log("➡️ Step 2: Sequelize sync...");
    await sequelize.sync();
    console.log("➡️ Step 2 done ✅");

    console.log("➡️ Step 3: Starting server...");
    const PORT = process.env.PORT || 3000;
    const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on ${BASE_URL}`);
    });

    // التعامل مع الأخطاء غير المعالجة
    process.on("unhandledRejection", (err) => {
      console.error("🔥 UNHANDLED REJECTION:", err);
    });

    process.on("uncaughtException", (err) => {
      console.error("🔥 UNCAUGHT EXCEPTION:", err);
    });

  } catch (err) {
    console.error("🔥 STARTUP ERROR:", err);
  }
})();
