const nodemailer = require("nodemailer");

console.log("========== MAIL CONFIG DEBUG ==========");
console.log("MAIL_USER:", process.env.MAIL_USER);
console.log("MAIL_PASS EXISTS:", !!process.env.MAIL_PASS);
console.log("=======================================");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,

  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },

  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,

  logger: true,
  debug: true,
});

console.log("========== SMTP VERIFY START ==========");

transporter.verify((error, success) => {
  if (error) {
    console.error("========== SMTP VERIFY ERROR ==========");
    console.error(error);
    console.error("CODE:", error.code);
    console.error("COMMAND:", error.command);
    console.error("======================================");
  } else {
    console.log("========== SMTP SERVER READY ==========");
    console.log(success);
    console.log("======================================");
  }
});

module.exports = transporter;
