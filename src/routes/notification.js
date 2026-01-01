const express = require('express');
const router = express.Router();
const NotificationService = require('../services/notificationService');
const authMiddleware = require('../middleware/auth');

/**
 * POST /api/notifications/save-token
 * حفظ device token عند تسجيل الدخول
 */
router.post('/save-token', authMiddleware, async (req, res) => {
  try {
    const { token, deviceInfo } = req.body;
    
    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    // احصل على userId و userType من الـ middleware
    const userId = req.user.id;
    const userType = req.user.role === 'admin' || req.user.role === 'technician' 
      ? req.user.role 
      : 'client';

    const result = await NotificationService.saveToken(
      userId,
      userType,
      token,
      deviceInfo
    );

    if (result.success) {
      res.json({ message: 'Token saved successfully' });
    } else {
      res.status(500).json({ message: 'Failed to save token', error: result.error });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /api/notifications/remove-token
 * حذف device token عند تسجيل الخروج
 */
router.post('/remove-token', authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    const result = await NotificationService.removeToken(token);

    if (result.success) {
      res.json({ message: 'Token removed successfully' });
    } else {
      res.status(500).json({ message: 'Failed to remove token', error: result.error });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /api/notifications/test
 * اختبار الإشعارات (للتطوير فقط)
 */
router.post('/test', authMiddleware, async (req, res) => {
  try {
    const { title, body } = req.body;
    
    const result = await NotificationService.sendToUser(
      req.user.id,
      req.user.role === 'admin' || req.user.role === 'technician' 
        ? req.user.role 
        : 'client',
      {
        title: title || 'Test Notification',
        body: body || 'This is a test notification',
        data: { type: 'test' }
      }
    );

    res.json(result);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/cleanup', authMiddleware, async (req, res) => {
  // تأكد أن المستخدم admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
  
  try {
    const result = await NotificationService.cleanupInvalidTokens();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /api/notifications/debug/:userId
 * عرض توكنات مستخدم معين للتصحيح
 */
router.get('/debug/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const userType = req.user.role === 'admin' || req.user.role === 'technician' 
      ? req.user.role 
      : 'client';
    
    const result = await NotificationService.debugUserTokens(userId, userType);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;