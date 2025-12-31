const jwt = require('jsonwebtoken');

/**
 * Auth Middleware
 * يتحقق من JWT ويضيف user إلى req
 */
module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // لازم يكون فيه Authorization Header
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Authorization token missing'
      });
    }

    // استخراج التوكن
    const token = authHeader.split(' ')[1];

    // فك التوكن
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // إرفاق بيانات المستخدم بالـ request
    req.user = {
      id: decoded.id,
      role: decoded.role, // admin | technician | client
      email: decoded.email
    };

    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error.message);

    return res.status(401).json({
      message: 'Invalid or expired token'
    });
  }
};
