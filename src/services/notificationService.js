// services/notificationService.js
const admin = require('firebase-admin');
const DeviceToken = require('../models/deviceToken');

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
      
      // ✅ الحل: استخدام send() لكل token بدلاً من sendMulticast
      const promises = tokenStrings.map(token => {
        const message = {
          notification: {
            title: notification.title,
            body: notification.body
          },
          data: notification.data || {},
          token: token // ⚠️ لاحظ: token مفرد وليس tokens
        };
        
        return admin.messaging().send(message)
          .then(() => {
            console.log(`✅ Notification sent successfully to token: ${token.substring(0, 20)}...`);
            return { success: true, token };
          })
          .catch(error => {
            console.error(`❌ Failed to send to token: ${token.substring(0, 20)}...`);
            console.error(`Error code: ${error.code}`);
            console.error(`Error message: ${error.message}`);
            return { success: false, token, error };
          });
      });

      const results = await Promise.all(promises);
      
      // حساب النجاح والفشل
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      // حذف الـ tokens الفاشلة
      const failedTokens = results
        .filter(r => !r.success)
        .filter(r => {
          const errorCode = r.error?.code;
          return (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          );
        })
        .map(r => r.token);

      if (failedTokens.length > 0) {
        await DeviceToken.destroy({
          where: { token: failedTokens }
        });
        console.log(`🗑️ Removed ${failedTokens.length} invalid tokens`);
      }

      console.log(`✅ Sent notification to user ${userId}: ${successCount}/${tokenStrings.length} successful`);
      
      return {
        success: successCount > 0,
        successCount,
        failureCount
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
   * حفظ أو تحديث device token
   */
static async saveToken(userId, userType, token, deviceInfo = null) {
    try {
      // 🔍 **التحقق 1: التأكد أن التوكن ليس JWT**
      if (this.isJwtToken(token)) {
        console.error('❌ ERROR: This is a JWT authentication token, not FCM token!');
        console.error('❌ Token preview:', token.substring(0, 50) + '...');
        return { 
          success: false, 
          error: 'Invalid token type. Please send FCM registration token from Firebase Messaging, not authentication token.' 
        };
      }

      // 🔍 **التحقق 2: التأكد أن التوكن هو FCM صالح**
      if (!this.isValidFcmToken(token)) {
        console.error('❌ ERROR: Invalid FCM token format');
        console.error('❌ Token length:', token.length);
        console.error('❌ Token starts with:', token.substring(0, 20));
        return { 
          success: false, 
          error: 'Invalid FCM token format. Token should be a long string starting with letters/numbers.' 
        };
      }

      // 🔍 **سجل التوكن الصحيح للتتبع**
      console.log('✅ Valid FCM token detected:');
      console.log('   - Length:', token.length);
      console.log('   - Preview:', token.substring(0, 30) + '...');
      console.log('   - For user:', userId, '(', userType, ')');

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
   * 🔍 **تحقق إذا كان التوكن JWT**
   */
  static isJwtToken(token) {
    if (!token || typeof token !== 'string') return false;
    
    // JWT tokens لها 3 أجزاء مفصولة بنقطة: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    // تبدأ عادة بـ eyJ (base64 encoded JSON)
    if (!token.startsWith('eyJ')) return false;
    
    try {
      // يمكننا فحص الـ header لنتأكد
      const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
      return header && header.typ === 'JWT';
    } catch {
      return false;
    }
  }

  /**
   * 🔍 **تحقق إذا كان التوكن FCM صالح**
   */
  static isValidFcmToken(token) {
    if (!token || typeof token !== 'string') return false;
    
    // FCM tokens عادة:
    // - طولها بين 100 و 400 حرف
    // - تحتوي على أحرف وأرقام وشرطات
    // - لا تحتوي على مسافات أو رموز غريبة
    
    const lengthOk = token.length > 100 && token.length < 500;
    const formatOk = /^[A-Za-z0-9_-]+$/.test(token);
    const notJwt = !this.isJwtToken(token);
    
    return lengthOk && formatOk && notJwt;
  }

  static async cleanupInvalidTokens() {
  try {
    console.log('🧹 Starting cleanup of invalid tokens...');
    
    const allTokens = await DeviceToken.findAll();
    let deletedCount = 0;
    let keptCount = 0;
    
    for (const tokenRecord of allTokens) {
      const token = tokenRecord.token;
      
      if (this.isJwtToken(token) || !this.isValidFcmToken(token)) {
        console.log(`🗑️ Deleting invalid token for user ${tokenRecord.userId}:`);
        console.log(`   Type: ${this.isJwtToken(token) ? 'JWT token' : 'Invalid format'}`);
        console.log(`   Preview: ${token.substring(0, 50)}...`);
        
        await tokenRecord.destroy();
        deletedCount++;
      } else {
        keptCount++;
      }
    }
    
    console.log(`✅ Cleanup completed:`);
    console.log(`   - Deleted: ${deletedCount} invalid tokens`);
    console.log(`   - Kept: ${keptCount} valid tokens`);
    
    return { 
      success: true, 
      deletedCount, 
      keptCount 
    };
    
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * عرض توكنات المستخدم للتصحيح
 */
static async debugUserTokens(userId, userType) {
  try {
    const tokens = await DeviceToken.findAll({
      where: {
        userId,
        userType,
        isActive: true
      }
    });
    
    const formatted = tokens.map(t => ({
      id: t.id,
      token: t.token,
      preview: t.token.substring(0, 30) + '...',
      length: t.token.length,
      isValidFcm: this.isValidFcmToken(t.token),
      isJwt: this.isJwtToken(t.token),
      deviceInfo: t.deviceInfo,
      lastUsed: t.lastUsedAt
    }));
    
    return { success: true, tokens: formatted };
  } catch (error) {
    console.error('Debug error:', error);
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