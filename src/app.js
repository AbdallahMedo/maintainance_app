const express = require("express");
const cors = require("cors");
const app = express();
const admin = require("firebase-admin");
require("dotenv").config(); // يقرأ المتغيرات من .env

// تهيئة Firebase
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  })
});

console.log("✅ Firebase Admin SDK initialized");

// Routes
const authRoutes = require("./routes/auth.routes");
const maintenanceTeamRoutes = require("./routes/maintenanceTeam.routes");
const notificationRoutes = require("./routes/notification");

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/maintenance-team", maintenanceTeamRoutes);
app.use("/api/notifications", notificationRoutes);

module.exports = app;
