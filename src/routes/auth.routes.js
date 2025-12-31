// routes/authRoutes.js or auth.routes.js
const express = require("express");
const router = express.Router();

const c = require("../controllers/auth.controller");

// Registration & Verification
router.post("/register", c.register);
router.get("/verify-email/:token", c.verifyEmail);
router.post('/resend-verification', c.resendVerification);
router.get('/check-verification', c.checkVerification);

// Login
router.post("/login", c.login);
router.post("/google", c.googleLogin);

// Password Reset
router.post("/forget-password-email", c.forgetPasswordEmail);
router.get("/reset-password/:token", c.renderResetPasswordPage);
router.post("/reset-password-email", c.resetPasswordEmail); // Only one route!
router.get('/check-reset', c.checkReset);

module.exports = router;