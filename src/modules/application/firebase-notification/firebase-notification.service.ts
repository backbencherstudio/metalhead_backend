// modules/firebase-notification/firebase-notification.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FirebaseNotificationService implements OnModuleInit {
  private firebaseApp: admin.app.App;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService
  ) {}

  onModuleInit() {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    try {
      // Method 1: Using the JSON file directly
      const serviceAccountPath = path.join(
        process.cwd(),
        'src',
        'modules',
        'application',
        'firebase-notification',
        'config',
        'firebase-service-account.json'
      );

      if (fs.existsSync(serviceAccountPath)) {
        // Initialize with JSON file
        const serviceAccount = require(serviceAccountPath);
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id,
        });
      } else {
        // Method 2: Using environment variables (fallback)
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert({
            projectId: this.configService.get('FIREBASE_PROJECT_ID'),
            clientEmail: this.configService.get('FIREBASE_CLIENT_EMAIL'),
            privateKey: this.configService.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
          }),
          projectId: this.configService.get('FIREBASE_PROJECT_ID'),
        });
      }
      
      console.log('🔥 Firebase Admin initialized successfully!');
    } catch (error) {
      console.error('❌ Firebase initialization error:', error);
      throw error;
    }
  }

  // Send notification to specific device
  async sendToDevice(deviceToken: string, title: string, body: string, data?: any) {
    try {
      const message = {
        token: deviceToken,
        notification: {
          title: title,
          body: body,
        },
        data: data || {},
      };

      const response = await admin.messaging().send(message);
      console.log('✅ Notification sent successfully:', response);
      return response;
    } catch (error) {
      console.error('❌ Error sending notification:', error);
      throw error;
    }
  }

  // Send notification to multiple devices
  async sendToMultipleDevices(deviceTokens: string[], title: string, body: string, data?: any) {
    try {
      const message = {
        tokens: deviceTokens,
        notification: {
          title: title,
          body: body,
        },
        data: data || {},
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`✅ Notifications sent successfully. Success: ${response.successCount}, Failure: ${response.failureCount}`);
      return response;
    } catch (error) {
      console.error('❌ Error sending multiple notifications:', error);
      throw error;
    }
  }

  getMessaging(): admin.messaging.Messaging {
    return this.firebaseApp.messaging();
  }

  // ==================== NOTIFICATION EVENT HANDLERS ====================

  /**
   * Send job-related notification
   */
  async sendJobNotification({
    receiverId,
    jobId,
    jobTitle,
    jobPrice,
    jobLocation,
    senderId,
    notificationType = 'new_job',
    customTitle,
    customBody
  }: {
    receiverId: string;
    jobId: string;
    jobTitle: string;
    jobPrice: number;
    jobLocation: string;
    senderId: string;
    notificationType?: 'new_job' | 'job_accepted' | 'job_completed' | 'job_cancelled';
    customTitle?: string;
    customBody?: string;
  }): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: receiverId },
        select: { device_tokens: true, name: true }
      });

      if (!user?.device_tokens || user.device_tokens.length === 0) {
        console.log(`No device tokens found for user ${receiverId}`);
        return;
      }

      let title = customTitle;
      let body = customBody;

      if (!title || !body) {
        switch (notificationType) {
          case 'new_job':
            title = '🎯 New Job Available!';
            body = `${jobTitle} - $${jobPrice} in ${jobLocation}`;
            break;
          case 'job_accepted':
            title = '✅ Job Accepted!';
            body = `Your job "${jobTitle}" has been accepted by a helper`;
            break;
          case 'job_completed':
            title = '🏆 Job Completed!';
            body = `Your job "${jobTitle}" has been completed`;
            break;
          case 'job_cancelled':
            title = '❌ Job Cancelled';
            body = `Your job "${jobTitle}" has been cancelled`;
            break;
        }
      }

      const notificationData = {
        type: notificationType,
        job_id: jobId,
        job_title: jobTitle,
        job_price: jobPrice.toString(),
        job_location: jobLocation,
        sender_id: senderId,
        timestamp: new Date().toISOString()
      };

      await this.sendToMultipleDevices(user.device_tokens, title, body, notificationData);
      console.log(`✅ Job notification sent to user ${receiverId} for job ${jobId}`);
    } catch (error) {
      console.error(`Failed to send job notification to user ${receiverId}:`, error);
    }
  }

  /**
   * Send message notification
   */
  async sendMessageNotification({
    receiverId,
    senderId,
    conversationId,
    messageText,
    messageType = 'text'
  }: {
    receiverId: string;
    senderId: string;
    conversationId: string;
    messageText?: string;
    messageType?: 'text' | 'image' | 'audio' | 'file';
  }): Promise<void> {
    try {
      const [receiver, sender] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: receiverId },
          select: { device_tokens: true, name: true }
        }),
        this.prisma.user.findUnique({
          where: { id: senderId },
          select: { name: true, username: true }
        })
      ]);

      if (!receiver?.device_tokens || receiver.device_tokens.length === 0) {
        console.log(`No device tokens found for user ${receiverId}`);
        return;
      }

      const senderName = sender?.name || sender?.username || 'Someone';
      let title = '💬 New Message';
      let body = '';

      switch (messageType) {
        case 'text':
          body = messageText 
            ? `${senderName}: ${messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText}`
            : `${senderName} sent you a message`;
          break;
        case 'image':
          body = `${senderName} sent you an image`;
          break;
        case 'audio':
          body = `${senderName} sent you a voice message`;
          break;
        case 'file':
          body = `${senderName} sent you a file`;
          break;
        default:
          body = `${senderName} sent you a message`;
      }

      const notificationData = {
        type: 'message',
        conversation_id: conversationId,
        sender_id: senderId,
        sender_name: senderName,
        message_type: messageType,
        timestamp: new Date().toISOString()
      };

      await this.sendToMultipleDevices(receiver.device_tokens, title, body, notificationData);
      console.log(`✅ Message notification sent to user ${receiverId} from ${senderId}`);
    } catch (error) {
      console.error(`Failed to send message notification to user ${receiverId}:`, error);
    }
  }

  /**
   * Send review notification
   */
  async sendReviewNotification({
    receiverId,
    senderId,
    reviewId,
    reviewType = 'received',
    customTitle,
    customBody
  }: {
    receiverId: string;
    senderId: string;
    reviewId: string;
    reviewType?: 'received' | 'given';
    customTitle?: string;
    customBody?: string;
  }): Promise<void> {
    try {
      const [receiver, sender] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: receiverId },
          select: { device_tokens: true, name: true }
        }),
        this.prisma.user.findUnique({
          where: { id: senderId },
          select: { name: true, username: true }
        })
      ]);

      if (!receiver?.device_tokens || receiver.device_tokens.length === 0) {
        console.log(`No device tokens found for user ${receiverId}`);
        return;
      }

      const senderName = sender?.name || sender?.username || 'Someone';
      const title = customTitle || (reviewType === 'received' ? '⭐ New Review Received!' : '⭐ Review Posted!');
      const body = customBody || (reviewType === 'received' 
        ? `${senderName} left you a review`
        : `You reviewed ${senderName}`);

      const notificationData = {
        type: 'review',
        review_id: reviewId,
        sender_id: senderId,
        sender_name: senderName,
        review_type: reviewType,
        timestamp: new Date().toISOString()
      };

      await this.sendToMultipleDevices(receiver.device_tokens, title, body, notificationData);
      console.log(`✅ Review notification sent to user ${receiverId}`);
    } catch (error) {
      console.error(`Failed to send review notification to user ${receiverId}:`, error);
    }
  }

  /**
   * Send booking notification
   */
  async sendBookingNotification({
    receiverId,
    senderId,
    bookingId,
    bookingType = 'created',
    customTitle,
    customBody
  }: {
    receiverId: string;
    senderId: string;
    bookingId: string;
    bookingType?: 'created' | 'accepted' | 'rejected' | 'cancelled' | 'completed';
    customTitle?: string;
    customBody?: string;
  }): Promise<void> {
    try {
      const [receiver, sender] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: receiverId },
          select: { device_tokens: true, name: true }
        }),
        this.prisma.user.findUnique({
          where: { id: senderId },
          select: { name: true, username: true }
        })
      ]);

      if (!receiver?.device_tokens || receiver.device_tokens.length === 0) {
        console.log(`No device tokens found for user ${receiverId}`);
        return;
      }

      const senderName = sender?.name || sender?.username || 'Someone';
      let title = customTitle;
      let body = customBody;

      if (!title || !body) {
        switch (bookingType) {
          case 'created':
            title = '📅 New Booking Request';
            body = `${senderName} wants to book your service`;
            break;
          case 'accepted':
            title = '✅ Booking Accepted!';
            body = `${senderName} accepted your booking request`;
            break;
          case 'rejected':
            title = '❌ Booking Rejected';
            body = `${senderName} rejected your booking request`;
            break;
          case 'cancelled':
            title = '🚫 Booking Cancelled';
            body = `${senderName} cancelled the booking`;
            break;
          case 'completed':
            title = '🏆 Booking Completed!';
            body = `Your booking with ${senderName} has been completed`;
            break;
        }
      }

      const notificationData = {
        type: 'booking',
        booking_id: bookingId,
        sender_id: senderId,
        sender_name: senderName,
        booking_type: bookingType,
        timestamp: new Date().toISOString()
      };

      await this.sendToMultipleDevices(receiver.device_tokens, title, body, notificationData);
      console.log(`✅ Booking notification sent to user ${receiverId}`);
    } catch (error) {
      console.error(`Failed to send booking notification to user ${receiverId}:`, error);
    }
  }

  /**
   * Send payment notification
   */
  async sendPaymentNotification({
    receiverId,
    paymentId,
    amount,
    paymentType = 'received',
    customTitle,
    customBody
  }: {
    receiverId: string;
    paymentId: string;
    amount: number;
    paymentType?: 'received' | 'sent' | 'refunded' | 'failed';
    customTitle?: string;
    customBody?: string;
  }): Promise<void> {
    try {
      const receiver = await this.prisma.user.findUnique({
        where: { id: receiverId },
        select: { device_tokens: true, name: true }
      });

      if (!receiver?.device_tokens || receiver.device_tokens.length === 0) {
        console.log(`No device tokens found for user ${receiverId}`);
        return;
      }

      let title = customTitle;
      let body = customBody;

      if (!title || !body) {
        switch (paymentType) {
          case 'received':
            title = '💰 Payment Received!';
            body = `You received $${amount} payment`;
            break;
          case 'sent':
            title = '💸 Payment Sent';
            body = `You sent $${amount} payment`;
            break;
          case 'refunded':
            title = '🔄 Payment Refunded';
            body = `You received $${amount} refund`;
            break;
          case 'failed':
            title = '❌ Payment Failed';
            body = `Your $${amount} payment failed`;
            break;
        }
      }

      const notificationData = {
        type: 'payment_transaction',
        payment_id: paymentId,
        amount: amount.toString(),
        payment_type: paymentType,
        timestamp: new Date().toISOString()
      };

      await this.sendToMultipleDevices(receiver.device_tokens, title, body, notificationData);
      console.log(`✅ Payment notification sent to user ${receiverId}`);
    } catch (error) {
      console.error(`Failed to send payment notification to user ${receiverId}:`, error);
    }
  }

  /**
   * Send generic notification
   */
  async sendGenericNotification({
    receiverId,
    title,
    body,
    data = {}
  }: {
    receiverId: string;
    title: string;
    body: string;
    data?: any;
  }): Promise<void> {
    try {
      const receiver = await this.prisma.user.findUnique({
        where: { id: receiverId },
        select: { device_tokens: true, name: true }
      });

      if (!receiver?.device_tokens || receiver.device_tokens.length === 0) {
        console.log(`No device tokens found for user ${receiverId}`);
        return;
      }

      const notificationData = {
        type: 'generic',
        timestamp: new Date().toISOString(),
        ...data
      };

      await this.sendToMultipleDevices(receiver.device_tokens, title, body, notificationData);
      console.log(`✅ Generic notification sent to user ${receiverId}`);
    } catch (error) {
      console.error(`Failed to send generic notification to user ${receiverId}:`, error);
    }
  }

  // Test Firebase connection without sending notifications
async testFirebaseConnection(): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    // Check if Firebase app is initialized
    if (!this.firebaseApp) {
      throw new Error('Firebase app not initialized');
    }

    // Get the Firebase project information
    const auth = this.firebaseApp.auth();
    
    // Try to get a user list (just to test authentication)
    // This verifies our service account credentials are valid
    const listUsersResult = await auth.listUsers(1); // Get just 1 user to test
    
    // If we reach here, Firebase connection is successful
    return {
      success: true,
      message: '✅ Firebase connection successful!',
      details: {
        projectId: this.firebaseApp.options.projectId,
        serviceAccount: this.firebaseApp.options.credential?.['serviceAccountId'] || 'Unknown',
        timestamp: new Date().toISOString(),
        testUsersCount: listUsersResult.users.length
      }
    };
  } catch (error) {
    return {
      success: false,
      message: '❌ Firebase connection failed',
      details: {
        error: error.message,
        timestamp: new Date().toISOString(),
        suggestion: 'Check your service account credentials and project ID'
      }
    };
  }
}

// Test notification with validation (without sending)
async validateNotificationPayload(deviceToken: string, title: string, body: string): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Validate token format (basic check)
  if (!deviceToken || deviceToken.length < 10) {
    errors.push('Device token appears invalid');
  }

  // Validate title
  if (!title || title.trim().length === 0) {
    errors.push('Title is required');
  }

  // Validate body
  if (!body || body.trim().length === 0) {
    errors.push('Body is required');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}
}