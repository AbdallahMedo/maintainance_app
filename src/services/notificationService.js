// services/notificationService.js
const admin = require('firebase-admin');
const DeviceToken = require('../models/deviceToken');

// Initialize Firebase Admin (قم بهذا مرة واحدة في app.js)
// const serviceAccount = require('../path-to-your-firebase-adminsdk.json');
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

class NotificationService {
  /**
   * إرسال إشعار لمستخدم واحد
   */
  static async sendToUser(userId, userType, notification) {
    try {
      // جلب جميع tokens للمستخدم
      const tokens = await DeviceToken.findAll({
        where: {
          userId,
          userType,
          isActive: true
        }
      });

      if (tokens.length === 0) {
        console.log(`No tokens found for user ${userId} (${userType})`);
        return { success: false, message: 'No device tokens found' };
      }

      const tokenStrings = tokens.map(t => t.token);
      
      const message = {
        notification: {
          title: notification.title,
          body: notification.body
        },
        data: notification.data || {},
        tokens: tokenStrings
      };

      // إرسال الإشعار
      const response = await admin.messaging().sendMulticast(message);

      // تحديث أو حذف tokens الفاشلة
      await this.handleFailedTokens(response, tokens);

      console.log(`✅ Sent notification to user ${userId}: ${response.successCount}/${tokenStrings.length} successful`);
      
      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount
      };

    } catch (error) {
      console.error('Error sending notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * إرسال إشعار لعدة مستخدمين
   */
  static async sendToMultipleUsers(users, notification) {
    const results = [];
    
    for (const user of users) {
      const result = await this.sendToUser(user.userId, user.userType, notification);
      results.push({ userId: user.userId, userType: user.userType, ...result });
    }

    return results;
  }

  /**
   * حذف أو تعطيل الـ tokens الفاشلة
   */
  static async handleFailedTokens(response, tokens) {
    const failedTokens = [];
    
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const errorCode = resp.error?.code;
        
        // إذا كان الـ token غير صالح أو منتهي، قم بحذفه
        if (
          errorCode === 'messaging/invalid-registration-token' ||
          errorCode === 'messaging/registration-token-not-registered'
        ) {
          failedTokens.push(tokens[idx].token);
        }
      }
    });

    // حذف الـ tokens الفاشلة
    if (failedTokens.length > 0) {
      await DeviceToken.destroy({
        where: { token: failedTokens }
      });
      console.log(`🗑️ Removed ${failedTokens.length} invalid tokens`);
    }
  }

  /**
   * حفظ أو تحديث device token
   */
  static async saveToken(userId, userType, token, deviceInfo = null) {
    try {
      const [deviceToken, created] = await DeviceToken.findOrCreate({
        where: { token },
        defaults: {
          userId,
          userType,
          deviceInfo,
          isActive: true,
          lastUsedAt: new Date()
        }
      });

      if (!created) {
        // تحديث البيانات إذا كان الـ token موجود مسبقاً
        await deviceToken.update({
          userId,
          userType,
          deviceInfo,
          isActive: true,
          lastUsedAt: new Date()
        });
      }

      console.log(`✅ Token saved for user ${userId} (${userType})`);
      return { success: true, deviceToken };

    } catch (error) {
      console.error('Error saving token:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * حذف device token (عند Logout)
   */
  static async removeToken(token) {
    try {
      await DeviceToken.destroy({
        where: { token }
      });
      console.log(`✅ Token removed`);
      return { success: true };
    } catch (error) {
      console.error('Error removing token:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== إشعارات خاصة بنظام الصيانة ====================

  /**
   * إشعار للأدمن عند إنشاء طلب صيانة جديد
   */
  static async notifyAdminNewRequest(ticketNumber, clientName) {
    // جلب جميع الأدمن
    const MaintenanceTeam = require('../models/maintenanceTeam');
    const admins = await MaintenanceTeam.findAll({
      where: { role: 'admin' },
      attributes: ['id']
    });

    const notification = {
      title: '🔔 طلب صيانة جديد',
      body: `طلب جديد #${ticketNumber} من ${clientName}`,
      data: {
        type: 'new_request',
        ticketNumber,
        clientName,
        screen: 'RequestDetails'
      }
    };

    const users = admins.map(admin => ({
      userId: admin.id,
      userType: 'admin'
    }));

    return await this.sendToMultipleUsers(users, notification);
  }

  /**
   * إشعار للفني عند إسناد طلب له
   */
  static async notifyTechnicianAssigned(technicianId, ticketNumber, clientName) {
    const notification = {
      title: '🔧 تم إسناد طلب صيانة لك',
      body: `طلب #${ticketNumber} من العميل ${clientName}`,
      data: {
        type: 'assigned',
        ticketNumber,
        clientName,
        screen: 'RequestDetails'
      }
    };

    return await this.sendToUser(technicianId, 'technician', notification);
  }

  /**
   * إشعار للعميل عند إسناد الطلب
   */
  static async notifyClientRequestAssigned(clientId, ticketNumber, technicianName) {
    const notification = {
      title: '✅ تم إسناد طلبك',
      body: `تم إسناد طلب #${ticketNumber} للفني ${technicianName}`,
      data: {
        type: 'assigned_to_technician',
        ticketNumber,
        technicianName,
        screen: 'RequestDetails'
      }
    };

    return await this.sendToUser(clientId, 'client', notification);
  }

  /**
   * إشعار للعميل عند تحديث حالة الطلب
   */
  static async notifyClientStatusUpdate(clientId, ticketNumber, status, technicianName) {
    const statusMessages = {
      on_way: `الفني ${technicianName} في الطريق إليك`,
      arrived: `الفني ${technicianName} وصل إلى الموقع`,
      solved: `تم حل المشكلة بنجاح ✅`,
      not_solved: `لم يتم حل المشكلة`,
      canceled: `تم إلغاء الطلب`
    };

    const statusIcons = {
      on_way: '🚗',
      arrived: '📍',
      solved: '✅',
      not_solved: '❌',
      canceled: '🚫'
    };

    const notification = {
      title: `${statusIcons[status]} تحديث حالة الطلب #${ticketNumber}`,
      body: statusMessages[status],
      data: {
        type: 'status_update',
        ticketNumber,
        status,
        technicianName,
        screen: 'RequestDetails'
      }
    };

    return await this.sendToUser(clientId, 'client', notification);
  }

  /**
   * إشعار للأدمن عند إغلاق الطلب
   */
  static async notifyAdminRequestClosed(ticketNumber, status, technicianName) {
    const MaintenanceTeam = require('../models/maintenanceTeam');
    const admins = await MaintenanceTeam.findAll({
      where: { role: 'admin' },
      attributes: ['id']
    });

    const statusText = status === 'solved' ? 'تم الحل' : 'لم يتم الحل';
    const icon = status === 'solved' ? '✅' : '❌';

    const notification = {
      title: `${icon} إغلاق طلب #${ticketNumber}`,
      body: `${statusText} بواسطة ${technicianName}`,
      data: {
        type: 'request_closed',
        ticketNumber,
        status,
        technicianName,
        screen: 'RequestDetails'
      }
    };

    const users = admins.map(admin => ({
      userId: admin.id,
      userType: 'admin'
    }));

    return await this.sendToMultipleUsers(users, notification);
  }

  /**
   * إشعار للعميل بطلب التقييم
   */
  static async notifyClientRatingRequest(clientId, ticketNumber) {
    const notification = {
      title: '⭐ قيّم تجربتك',
      body: `يرجى تقييم الخدمة للطلب #${ticketNumber}`,
      data: {
        type: 'rating_request',
        ticketNumber,
        screen: 'Rating'
      }
    };

    return await this.sendToUser(clientId, 'client', notification);
  }
}

module.exports = NotificationService;