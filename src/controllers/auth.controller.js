  const bcrypt = require("bcryptjs");
  const jwt = require("jsonwebtoken");
  const { Op } = require("sequelize"); 
  const User = require("../models/user");
  // console.log("✅ User model loaded:", User === undefined ? "NO" : "YES");
  const sendEmail = require("../utils/sendEmail");

/* REGISTER */
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, confirmPassword } = req.body;

    if (password !== confirmPassword)
      return res.status(400).json({ message: "Password mismatch" });

const existingUser = await User.findOne({
  where: {
    [Op.or]: [{ email }, { phone }]
  }
});

if (existingUser) {
  if (existingUser.email === email) {
    if (existingUser.authProvider === 'google') {
      return res.status(400).json({ 
        message: "This email is registered with Google. Please use Google sign-in or reset password to convert to local account."
      });
    }
    return res.status(400).json({ message: "Email already registered" });
  }
  return res.status(400).json({ message: "Phone number already registered" });
}
    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
  name,
  email,
  phone,
  password: hash,
  authProvider: 'local'
});


    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const link = `${process.env.BASE_URL}/api/auth/verify-email/${token}`;

    await sendEmail(email, link, "verification");

    res.json({ message: "Check your email to verify account" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
  /* VERIFY EMAIL */
  exports.verifyEmail = async (req, res) => {
    try {
      const decoded = jwt.verify(req.params.token, process.env.JWT_SECRET);
      await User.update({ emailVerified: true }, { where: { id: decoded.id } });
      res.send("Email verified successfully");
    } catch (err) {
      console.error(err);
      res.status(400).send("Invalid or expired token");
    }
  };

  exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.emailVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const link = `${process.env.BASE_URL}/api/auth/verify-email/${token}`;

    await sendEmail(email, link, 'verification');

    res.json({ message: 'Verification email resent successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
// GET /auth/check-verification?email=...
exports.checkVerification = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ emailVerified: user.emailVerified });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /auth/check-reset?email=...
exports.checkReset = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // نجلب حالة reset (في هذا المثال نعتبر كلمة المرور تغيرت إذا تم آخر تحديث بعد إنشاء الطلب)
    const passwordChanged = user.updated_at > user.created_at;
    res.json({ passwordChanged });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
};


  /* LOGIN */

exports.login = async (req, res) => {
  try {
    // البحث عن المستخدم بدون شرط authProvider
    const user = await User.findOne({
      where: {
        email: req.body.email
      }
    });

    if (!user)
      return res.status(401).json({ message: "User not found" });

    // التحقق إذا كان الحساب مسجل بالجوجل
    if (user.authProvider === 'google') {
      return res.status(400).json({
        message: "This email is registered with Google. Please use Google sign-in"
      });
    }

    if (!user.emailVerified)
      return res.status(403).json({ message: "Email not verified" });

    // التحقق من الباسورد فقط للحسابات المحلية
    const ok = await bcrypt.compare(req.body.password, user.password);
    if (!ok)
      return res.status(401).json({ message: "Wrong credentials" });

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ✅ **الجديد: طلب وحفظ FCM token إذا أُرسل**
    const { fcmToken, deviceInfo } = req.body;
    
    if (fcmToken) {
      console.log('🔔 FCM token received in login request');
      console.log('   Token preview:', fcmToken.substring(0, 30) + '...');
      
      // تحديد userType بناءً على role
      const userType = user.role === 'admin' || user.role === 'technician' 
        ? user.role 
        : 'client';
      
      try {
        const result = await NotificationService.saveToken(
          user.id,
          userType,
          fcmToken,
          deviceInfo
        );
        
        if (result.success) {
          console.log('✅ FCM token saved successfully during login');
        } else {
          console.log('⚠️ Could not save FCM token:', result.error);
        }
      } catch (saveError) {
        console.error('❌ Error saving FCM token during login:', saveError);
        // لا نوقف عملية login إذا فشل حفظ token
      }
    }

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        authProvider: user.authProvider,
        role: user.role
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const { email, name, fcmToken, deviceInfo } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    let user = await User.findOne({ where: { email } });

    // منع Google إذا الحساب موجود كمحلي
    if (user && user.authProvider === 'local') {
      return res.status(400).json({
        message: "This email is already registered with email & password. Please login with password."
      });
    }

    // إذا كان الحساب موجود بالجوجل مسبقاً، استخدمه
    if (user && user.authProvider === 'google') {
      const token = jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      // ✅ **حفظ FCM token إذا أُرسل**
      if (fcmToken) {
        const userType = user.role === 'admin' || user.role === 'technician' 
          ? user.role 
          : 'client';
        
        await NotificationService.saveToken(
          user.id,
          userType,
          fcmToken,
          deviceInfo
        ).catch(err => {
          console.error('Error saving FCM token in Google login:', err);
        });
      }

      return res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          authProvider: user.authProvider,
          role: user.role
        }
      });
    }

    // إنشاء حساب جديد بالجوجل
    user = await User.create({
      name: name || "Google User",
      email,
      authProvider: 'google',
      emailVerified: true,
      password: 'GOOGLE_AUTH',
      phone: null,
      role: 'client' // تحديد role افتراضي
    });

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ✅ **حفظ FCM token إذا أُرسل**
    if (fcmToken) {
      await NotificationService.saveToken(
        user.id,
        'client', // حساب جديد يكون client
        fcmToken,
        deviceInfo
      ).catch(err => {
        console.error('Error saving FCM token for new Google user:', err);
      });
    }

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        authProvider: user.authProvider,
        role: 'client'
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.forgetPasswordEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ message: "User not found" });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "15m" });
    const resetLink = `${process.env.BASE_URL}/api/auth/reset-password/${token}`;

    await sendEmail(email, resetLink);

    res.json({ message: "Reset link sent to email" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.resetPasswordEmail = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    console.log('📥 Reset request received:', { 
      hasToken: !!token, 
      hasNewPassword: !!newPassword,
      hasConfirmPassword: !!confirmPassword 
    });

    // Validate inputs
    if (!token || !newPassword || !confirmPassword) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Error</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0;
              padding: 20px;
            }
            .card {
              background: white;
              padding: 40px;
              border-radius: 20px;
              text-align: center;
              max-width: 500px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            .icon {
              font-size: 60px;
              margin-bottom: 20px;
            }
            h2 {
              color: #dc2626;
              margin-bottom: 15px;
            }
            p {
              color: #64748b;
              line-height: 1.6;
            }
            a {
              display: inline-block;
              margin-top: 20px;
              padding: 12px 30px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">⚠️</div>
            <h2>Missing Information</h2>
            <p>All fields are required. Please go back and fill in all fields.</p>
            <a href="javascript:history.back()">Go Back</a>
          </div>
        </body>
        </html>
      `);
    }

    if (newPassword !== confirmPassword) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Error</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0;
              padding: 20px;
            }
            .card {
              background: white;
              padding: 40px;
              border-radius: 20px;
              text-align: center;
              max-width: 500px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            .icon {
              font-size: 60px;
              margin-bottom: 20px;
            }
            h2 {
              color: #dc2626;
              margin-bottom: 15px;
            }
            p {
              color: #64748b;
              line-height: 1.6;
            }
            a {
              display: inline-block;
              margin-top: 20px;
              padding: 12px 30px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">❌</div>
            <h2>Passwords Don't Match</h2>
            <p>The passwords you entered don't match. Please try again.</p>
            <a href="javascript:history.back()">Go Back</a>
          </div>
        </body>
        </html>
      `);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✅ Token verified for user ID:', decoded.id);
    } catch (err) {
      console.error('❌ Token verification failed:', err.message);
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Link Expired</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0;
              padding: 20px;
            }
            .card {
              background: white;
              padding: 40px;
              border-radius: 20px;
              text-align: center;
              max-width: 500px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            .icon {
              font-size: 60px;
              margin-bottom: 20px;
            }
            h2 {
              color: #dc2626;
              margin-bottom: 15px;
            }
            p {
              color: #64748b;
              line-height: 1.6;
              margin-bottom: 10px;
            }
            .error-detail {
              background: #fef2f2;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
              color: #991b1b;
              font-size: 14px;
            }
            a {
              display: inline-block;
              margin-top: 20px;
              padding: 12px 30px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">⏰</div>
            <h2>Link Expired or Invalid</h2>
            <p>This password reset link has expired or is invalid.</p>
            <div class="error-detail">
              Error: ${err.message}
            </div>
            <p>Password reset links expire after 15 minutes for security reasons.</p>
            <p>Please request a new password reset link.</p>
            <a href="${process.env.BASE_URL || 'http://localhost:3000'}">Go to Homepage</a>
          </div>
        </body>
        </html>
      `);
    }

    // Find user
    const user = await User.findByPk(decoded.id);
    if (!user) {
      console.error('❌ User not found for ID:', decoded.id);
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>User Not Found</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0;
              padding: 20px;
            }
            .card {
              background: white;
              padding: 40px;
              border-radius: 20px;
              text-align: center;
              max-width: 500px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            .icon {
              font-size: 60px;
              margin-bottom: 20px;
            }
            h2 {
              color: #dc2626;
              margin-bottom: 15px;
            }
            p {
              color: #64748b;
              line-height: 1.6;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">❌</div>
            <h2>User Not Found</h2>
            <p>The user associated with this reset link could not be found.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Hash new password
    const hash = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hash });

    console.log('✅ Password reset successful for user:', user.email);

    // Success response
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Successful</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 20px;
          }
          .card {
            background: white;
            padding: 50px 40px;
            border-radius: 20px;
            text-align: center;
            max-width: 500px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            animation: slideUp 0.5s ease;
          }
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .success-icon {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 25px;
            font-size: 40px;
          }
          h2 {
            color: #1e293b;
            margin-bottom: 15px;
            font-size: 28px;
          }
          p {
            color: #64748b;
            line-height: 1.6;
            margin-bottom: 30px;
            font-size: 16px;
          }
          .info-box {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 25px;
            color: #166534;
          }
          a {
            display: inline-block;
            padding: 14px 35px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 600;
            transition: transform 0.2s;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
          }
          a:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="success-icon">✓</div>
          <h2>Password Reset Successful!</h2>
          <p>Your password has been successfully changed.</p>
          <div class="info-box">
            <strong>✓</strong> Your new password is now active<br>
            <strong>✓</strong> You can now log in with your new credentials
          </div>
          <p>You can now close this window and log in to your account using your new password.</p>
          <a href="${process.env.BASE_URL || 'http://localhost:3000'}">Return to Login</a>
        </div>
        
        <script>
          // Auto-close after 3 seconds if opened in popup
          setTimeout(() => {
            if (window.opener) {
              window.close();
            }
          }, 3000);
        </script>
      </body>
      </html>
    `);

  } catch (err) {
    console.error('❌ Reset password error:', err);
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Error</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 20px;
          }
          .card {
            background: white;
            padding: 40px;
            border-radius: 20px;
            text-align: center;
            max-width: 500px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          }
          .icon {
            font-size: 60px;
            margin-bottom: 20px;
          }
          h2 {
            color: #dc2626;
            margin-bottom: 15px;
          }
          p {
            color: #64748b;
            line-height: 1.6;
          }
          .error-detail {
            background: #fef2f2;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            color: #991b1b;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">❌</div>
          <h2>Something Went Wrong</h2>
          <div class="error-detail">
            ${err.message}
          </div>
          <p>Please try again or contact support if the problem persists.</p>
        </div>
      </body>
      </html>
    `);
  }
};

exports.renderResetPasswordPage = (req, res) => {
  const { token } = req.params;
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  // Validate token first before rendering the page
  if (!token) {
    return res.send('Invalid reset link');
  }

  console.log('🔑 Token received:', token.substring(0, 20) + '...');

  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reset Password - Chem Tech Company</title>
<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  
  .container {
    background: white;
    padding: 50px 40px;
    width: 100%;
    max-width: 480px;
    border-radius: 20px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  }
  
  .logo {
    text-align: center;
    margin-bottom: 30px;
  }
  
  .logo svg {
    width: 70px;
    height: 70px;
    margin-bottom: 15px;
  }
  
  .logo h1 {
    color: #1e293b;
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 5px;
  }
  
  .logo p {
    color: #64748b;
    font-size: 14px;
  }
  
  .header {
    text-align: center;
    margin-bottom: 35px;
  }
  
  .header h2 {
    color: #1e293b;
    font-size: 28px;
    font-weight: 700;
    margin-bottom: 10px;
  }
  
  .header p {
    color: #64748b;
    font-size: 15px;
    line-height: 1.5;
  }
  
  .form-group {
    margin-bottom: 25px;
    position: relative;
  }
  
  .form-group label {
    display: block;
    color: #334155;
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  
  .password-input-wrapper {
    position: relative;
  }
  
  .form-group input {
    width: 100%;
    padding: 14px 45px 14px 45px;
    border-radius: 10px;
    border: 2px solid #e2e8f0;
    font-size: 15px;
    transition: all 0.3s ease;
    background: #f8fafc;
  }
  
  .form-group input:focus {
    outline: none;
    border-color: #667eea;
    background: white;
    box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
  }
  
  .input-icon {
    position: absolute;
    left: 15px;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
    pointer-events: none;
  }
  
  .toggle-password {
    position: absolute;
    right: 15px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    color: #94a3b8;
    padding: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.3s ease;
  }
  
  .toggle-password:hover {
    color: #667eea;
  }
  
  .password-strength {
    margin-top: 10px;
    font-size: 13px;
  }
  
  .strength-bar {
    height: 4px;
    background: #e2e8f0;
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 5px;
  }
  
  .strength-bar-fill {
    height: 100%;
    width: 0%;
    transition: all 0.3s ease;
    border-radius: 2px;
  }
  
  .strength-text {
    color: #64748b;
    font-size: 12px;
  }
  
  .requirements {
    background: #f8fafc;
    border-radius: 10px;
    padding: 15px;
    margin-top: 20px;
    font-size: 13px;
  }
  
  .requirements p {
    color: #334155;
    font-weight: 600;
    margin-bottom: 10px;
  }
  
  .requirements ul {
    list-style: none;
    padding: 0;
  }
  
  .requirements li {
    color: #64748b;
    padding: 5px 0;
    display: flex;
    align-items: center;
  }
  
  .requirements li::before {
    content: "•";
    color: #94a3b8;
    margin-right: 8px;
    font-size: 18px;
  }
  
  .requirements li.valid {
    color: #10b981;
  }
  
  .requirements li.valid::before {
    content: "✓";
    color: #10b981;
  }
  
  button[type="submit"] {
    width: 100%;
    padding: 16px;
    border: none;
    border-radius: 10px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }
  
  button[type="submit"]:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
  }
  
  button[type="submit"]:active {
    transform: translateY(0);
  }
  
  button[type="submit"]:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
  
  .message {
    margin-top: 20px;
    padding: 15px;
    border-radius: 10px;
    text-align: center;
    font-size: 14px;
    display: none;
  }
  
  .message.error {
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
    display: block;
  }
  
  .message.success {
    background: #f0fdf4;
    color: #16a34a;
    border: 1px solid #bbf7d0;
    display: block;
  }
  
  @media (max-width: 500px) {
    .container {
      padding: 40px 25px;
    }
    
    .header h2 {
      font-size: 24px;
    }
  }
</style>
</head>
<body>

<div class="container">
  <div class="logo">
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
      </defs>
      <path d="M35 10 L35 35 L25 60 Q25 75 40 80 L60 80 Q75 75 75 60 L65 35 L65 10 Z" 
            fill="url(#grad1)" stroke="#667eea" stroke-width="2"/>
      <rect x="40" y="5" width="20" height="10" fill="#667eea" rx="2"/>
      <circle cx="45" cy="55" r="4" fill="white" opacity="0.7"/>
      <circle cx="55" cy="48" r="3" fill="white" opacity="0.7"/>
      <circle cx="50" cy="65" r="3.5" fill="white" opacity="0.7"/>
    </svg>
    
    <h1>Chem Tech Company</h1>
    <p>Secure Password Reset</p>
  </div>

  <div class="header">
    <h2>Create New Password</h2>
    <p>Your new password must be different from previously used passwords.</p>
  </div>

  <form id="resetForm" method="POST" action="${baseUrl}/api/auth/reset-password-email">
    <input type="hidden" name="token" value="${token}" />
    
    <div class="form-group">
      <label for="newPassword">New Password</label>
      <div class="password-input-wrapper">
        <span class="input-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </span>
        <input type="password" name="newPassword" id="newPassword" placeholder="Enter new password" required />
        <button type="button" class="toggle-password" onclick="togglePassword('newPassword')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>
      </div>
      <div class="password-strength" id="passwordStrength">
        <div class="strength-bar">
          <div class="strength-bar-fill" id="strengthBar"></div>
        </div>
        <div class="strength-text" id="strengthText"></div>
      </div>
    </div>
    
    <div class="form-group">
      <label for="confirmPassword">Confirm Password</label>
      <div class="password-input-wrapper">
        <span class="input-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </span>
        <input type="password" name="confirmPassword" id="confirmPassword" placeholder="Confirm new password" required />
        <button type="button" class="toggle-password" onclick="togglePassword('confirmPassword')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>
      </div>
    </div>
    
    <div class="requirements">
      <p>Password must contain:</p>
      <ul>
        <li id="req-length">At least 8 characters</li>
        <li id="req-upper">One uppercase letter</li>
        <li id="req-lower">One lowercase letter</li>
        <li id="req-number">One number</li>
      </ul>
    </div>
    
    <button type="submit" id="submitBtn">
      Reset Password
    </button>
    
    <div class="message" id="message"></div>
  </form>
</div>

<script>
  function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const button = input.nextElementSibling;
    
    if (input.type === 'password') {
      input.type = 'text';
      button.innerHTML = \`
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      \`;
    } else {
      input.type = 'password';
      button.innerHTML = \`
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      \`;
    }
  }
  
  const newPasswordInput = document.getElementById('newPassword');
  const strengthBar = document.getElementById('strengthBar');
  const strengthText = document.getElementById('strengthText');
  
  newPasswordInput.addEventListener('input', function() {
    const password = this.value;
    let strength = 0;
    
    const hasLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    document.getElementById('req-length').className = hasLength ? 'valid' : '';
    document.getElementById('req-upper').className = hasUpper ? 'valid' : '';
    document.getElementById('req-lower').className = hasLower ? 'valid' : '';
    document.getElementById('req-number').className = hasNumber ? 'valid' : '';
    
    if (hasLength) strength++;
    if (hasUpper) strength++;
    if (hasLower) strength++;
    if (hasNumber) strength++;
    if (password.length >= 12) strength++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;
    
    const percentage = (strength / 6) * 100;
    strengthBar.style.width = percentage + '%';
    
    if (strength <= 2) {
      strengthBar.style.background = '#ef4444';
      strengthText.textContent = 'Weak password';
      strengthText.style.color = '#ef4444';
    } else if (strength <= 4) {
      strengthBar.style.background = '#f59e0b';
      strengthText.textContent = 'Medium password';
      strengthText.style.color = '#f59e0b';
    } else {
      strengthBar.style.background = '#10b981';
      strengthText.textContent = 'Strong password';
      strengthText.style.color = '#10b981';
    }
  });
  
  document.getElementById('resetForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const token = document.querySelector('input[name="token"]').value;
    const messageDiv = document.getElementById('message');
    const submitBtn = document.getElementById('submitBtn');
    
    console.log('🔍 Form submission:', {
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      hasNewPassword: !!newPassword,
      hasConfirmPassword: !!confirmPassword
    });
    
    messageDiv.className = 'message';
    messageDiv.textContent = '';
    
    if (newPassword.length < 8) {
      messageDiv.className = 'message error';
      messageDiv.textContent = 'Password must be at least 8 characters long';
      return;
    }
    
    if (!/[A-Z]/.test(newPassword)) {
      messageDiv.className = 'message error';
      messageDiv.textContent = 'Password must contain at least one uppercase letter';
      return;
    }
    
    if (!/[a-z]/.test(newPassword)) {
      messageDiv.className = 'message error';
      messageDiv.textContent = 'Password must contain at least one lowercase letter';
      return;
    }
    
    if (!/[0-9]/.test(newPassword)) {
      messageDiv.className = 'message error';
      messageDiv.textContent = 'Password must contain at least one number';
      return;
    }
    
    if (newPassword !== confirmPassword) {
      messageDiv.className = 'message error';
      messageDiv.textContent = 'Passwords do not match';
      return;
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Resetting...';
    this.submit();
  });
</script>

</body>
</html>
  `);
};