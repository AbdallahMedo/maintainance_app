// config/db.js
const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 1433, // <-- مهم
    dialect: "mssql",
    logging: false,
    dialectOptions: {
      options: {
        encrypt: true,                 // لو السيرفر يدعم TLS
        trustServerCertificate: true,  // لو ما عندكش شهادة موثوقة
        enableArithAbort: true,
      },
    },
  }
);


async function connectDB() {
  try {
    console.log("🔌 Connecting to SQL Server...");
    await sequelize.authenticate();
    console.log("✅ SQL Server Connected");
  } catch (err) {
    console.error("❌ DB CONNECTION FAILED");
    console.error(err);
  }
}

module.exports = {
  sequelize,
  connectDB,
};
