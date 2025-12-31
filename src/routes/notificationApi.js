// routes/notificationApi.js
// هذا الملف يحتوي على Endpoints التي تستدعيها Cloud Functions

const express = require('express');
const router = express.Router();
const NotificationService = require('../services/notificationService');

/**
 * POST /api/notifications/admin/new-request
 * إشعار للأدمن بطلب جديد
 */
router.post('/admin/new-request', async (req, res) => {
  try {
    const { ticketNumber, clientName } = req.body;
    
    if (!ticketNumber || !clientName) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const result = await NotificationService.notifyAdminNewRequest(
      ticketNumber,
      clientName
    );

    res.json({ success: true, result });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /api/notifications/technician/assigned
 * إشعار للفني عند إسناد طلب له
 */
router.post('/technician/assigned', async (req, res) => {
  try {
    const { technicianId, ticketNumber, clientName } = req.body;
    
    if (!technicianId || !ticketNumber || !clientName) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const result = await NotificationService.notifyTechnicianAssigned(
      technicianId,
      ticketNumber,
      clientName
    );

    res.json({ success: true, result });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /api/notifications/client/assigned
 * إشعار للعميل عند إسناد الطلب
 */
router.post('/client/assigned', async (req, res) => {
  try {
    const { clientId, ticketNumber, technicianName } = req.body;
    
    if (!clientId || !ticketNumber || !technicianName) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const result = await NotificationService.notifyClientRequestAssigned(
      clientId,
      ticketNumber,
      technicianName
    );

    res.json({ success: true, result });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /api/notifications/client/status-update
 * إشعار للعميل عند تحديث حالة الطلب
 */
router.post('/client/status-update', async (req, res) => {
  try {
    const { clientId, ticketNumber, status, technicianName } = req.body;
    
    if (!clientId || !ticketNumber || !status || !technicianName) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const result = await NotificationService.notifyClientStatusUpdate(
      clientId,
      ticketNumber,
      status,
      technicianName
    );

    res.json({ success: true, result });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /api/notifications/admin/request-closed
 * إشعار للأدمن عند إغلاق طلب
 */
router.post('/admin/request-closed', async (req, res) => {
  try {
    const { ticketNumber, status, technicianName } = req.body;
    
    if (!ticketNumber || !status || !technicianName) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const result = await NotificationService.notifyAdminRequestClosed(
      ticketNumber,
      status,
      technicianName
    );

    res.json({ success: true, result });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /api/notifications/client/rating-request
 * طلب تقييم من العميل
 */
router.post('/client/rating-request', async (req, res) => {
  try {
    const { clientId, ticketNumber } = req.body;
    
    if (!clientId || !ticketNumber) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const result = await NotificationService.notifyClientRatingRequest(
      clientId,
      ticketNumber
    );

    res.json({ success: true, result });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /api/notifications/technician/rating-received
 * إشعار للفني عند استلام تقييم
 */
router.post('/technician/rating-received', async (req, res) => {
  try {
    const { technicianId, stars, ticketNumber } = req.body;
    
    if (!technicianId || !stars || !ticketNumber) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const notification = {
      title: '⭐ تقييم جديد',
      body: `حصلت على ${stars} نجوم للطلب #${ticketNumber}`,
      data: {
        type: 'rating_received',
        stars: stars.toString(),
        ticketNumber,
        screen: 'Profile'
      }
    };

    const result = await NotificationService.sendToUser(
      technicianId,
      'technician',
      notification
    );

    res.json({ success: true, result });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;