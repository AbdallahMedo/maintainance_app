const nodemailer = require("nodemailer");

console.log("=== MAIL CONFIG DEBUG ===");
console.log("MAIL_USER:", process.env.MAIL_USER);
console.log("MAIL_PASS exists:", !!process.env.MAIL_PASS);

const transporter = nodemailer.createTransport({
  service: "gmail",
    // host: "smtp.gmail.com",
    // port: 587,
    // secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP VERIFY ERROR:", error);
  } else {
    console.log("SMTP SERVER READY");
  }
});

module.exports = transporter;
