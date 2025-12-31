const express = require("express");
const cors = require("cors");
const app = express();
const admin = require('firebase-admin');
const serviceAccount = require('./config/service.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
console.log('✅ Firebase Admin SDK initialized');


const authRoutes = require("./routes/auth.routes");
const maintenanceTeamRoutes = require('./routes/maintenanceTeam.routes');
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use('/api/maintenance-team', maintenanceTeamRoutes);
const notificationRoutes = require('./routes/notification');
app.use('/api/notifications', notificationRoutes);
module.exports = app;
