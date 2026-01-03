const express = require("express");
const cors = require("cors");
const app = express();
const admin = require("firebase-admin");
const notificationApiRoutes = require("./routes/notificationApi");
require("dotenv").config();

// ✅ تهيئة Firebase بـ 3 طرق مختلفة
try {
  let firebaseConfig;
  
  // الطريقة 1: استخدام Base64 (الأفضل للـ production)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const serviceAccountJson = Buffer.from(
      process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 
      'base64'
    ).toString('utf8');
    const serviceAccount = JSON.parse(serviceAccountJson);
    
    firebaseConfig = {
      credential: admin.credential.cert(serviceAccount)
    };
    console.log("🔥 Using Firebase Base64 credentials");
  }
  // الطريقة 2: استخدام ملف JSON (محلياً)
  else if (process.env.NODE_ENV !== 'production') {
    const serviceAccount = require('./config/service.json');
    firebaseConfig = {
      credential: admin.credential.cert(serviceAccount)
    };
    console.log("🔥 Using Firebase JSON file (local)");
  } 
  // الطريقة 3: استخدام Environment Variables منفصلة
  else {
    firebaseConfig = {
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")
      })
    };
    console.log("🔥 Using Firebase environment variables");
  }
  
  admin.initializeApp(firebaseConfig);
  console.log("✅ Firebase Admin SDK initialized successfully");
  
} catch (error) {
  console.error("❌ Firebase initialization failed:");
  console.error("Error message:", error.message);
  if (process.env.NODE_ENV === 'development') {
    console.error("Full error:", error);
  }
  process.exit(1);
}

// Routes
const authRoutes = require("./routes/auth.routes");
const maintenanceTeamRoutes = require("./routes/maintenanceTeam.routes");
const notificationRoutes = require("./routes/notification");

// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/maintenance-team", maintenanceTeamRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/notifications", notificationApiRoutes);

// ✅ Health check endpoint للتأكد من Firebase
app.get("/api/health", async (req, res) => {
  try {
    // محاولة الوصول لـ Firebase لاختبار الاتصال
    await admin.app().options.credential.getAccessToken();
    res.json({ 
      status: "OK", 
      firebase: "Connected",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: "ERROR", 
      firebase: "Disconnected",
      error: error.message 
    });
  }
});

// ✅ 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ✅ Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({ 
    message: "Internal server error",
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app;