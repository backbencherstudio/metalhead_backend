// modules/firebase-notification/firebase-notification.controller.ts
import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { FirebaseNotificationService } from './firebase-notification.service';

@Controller('firebase-notifications')
export class FirebaseNotificationController {
  constructor(
    private readonly firebaseNotificationService: FirebaseNotificationService,
  ) {}

  // 📱 Test Single Device Notification
  @Post('send-to-device')
  async sendToDevice(
    @Body() body: { 
      deviceToken: string; 
      title?: string; 
      body?: string; 
      data?: any 
    }
  ) {
    try {
      const result = await this.firebaseNotificationService.sendToDevice(
        body.deviceToken,
        body.title || '🚀 Default Title',
        body.body || 'This is a test notification from your NestJS app!',
        body.data || { type: 'test', click_action: 'FLUTTER_NOTIFICATION_CLICK' }
      );
      
      return {
        success: true,
        message: 'Notification sent successfully to single device',
        data: {
          messageId: result,
          deviceToken: body.deviceToken,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to send notification',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // 📱📱 Test Multiple Devices Notification
  @Post('send-to-multiple')
  async sendToMultipleDevices(
    @Body() body: { 
      deviceTokens: string[]; 
      title?: string; 
      body?: string; 
      data?: any 
    }
  ) {
    try {
      const result = await this.firebaseNotificationService.sendToMultipleDevices(
        body.deviceTokens,
        body.title || '👥 Group Notification',
        body.body || 'This is a group notification from your NestJS app!',
        body.data || { type: 'group_test', timestamp: new Date().toISOString() }
      );
      
      return {
        success: true,
        message: 'Notifications sent to multiple devices',
        data: {
          successCount: result.successCount,
          failureCount: result.failureCount,
          responses: result.responses,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to send multiple notifications',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // 🔍 Health Check Endpoint
  @Get('health')
  async healthCheck() {
    return {
      success: true,
      service: 'Firebase Notification Service',
      status: 'Operational',
      timestamp: new Date().toISOString(),
      endpoints: {
        'POST /notifications/send-to-device': 'Send to single device',
        'POST /notifications/send-to-multiple': 'Send to multiple devices',
        'GET /notifications/health': 'Service health check'
      }
    };
  }

  // 🎯 Quick Test Endpoint (Simple)
  @Post('quick-test')
  async quickTest(@Body() body: { deviceToken: string }) {
    return this.sendToDevice({
      deviceToken: body.deviceToken,
      title: '⚡ Quick Test!',
      body: 'This is a quick test notification!',
      data: { test_type: 'quick', urgent: 'false' }
    });
  }


  // 🔧 Test Firebase Connection
@Get('test-connection')
async testFirebaseConnection() {
  try {
    const result = await this.firebaseNotificationService.testFirebaseConnection();
    return {
      ...result,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    };
  } catch (error) {
    return {
      success: false,
      message: 'Connection test failed',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// 📝 Validate Notification Payload (without sending)
@Post('validate-payload')
async validatePayload(
  @Body() body: { 
    deviceToken: string; 
    title?: string; 
    body?: string; 
  }
) {
  try {
    const validation = await this.firebaseNotificationService.validateNotificationPayload(
      body.deviceToken || 'test_token_123', // Use test token for validation
      body.title || 'Test Title',
      body.body || 'Test Body'
    );

    return {
      success: true,
      valid: validation.valid,
      errors: validation.errors,
      message: validation.valid ? 
        '✅ Payload is valid for sending' : 
        '❌ Payload has validation errors',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      valid: false,
      errors: [error.message],
      timestamp: new Date().toISOString()
    };
  }
}

// 🎯 Dry Run - Test notification preparation
@Post('dry-run')
async dryRunNotification(
  @Body() body: { 
    deviceToken: string; 
    title?: string; 
    body?: string; 
    data?: any 
  }
) {
  try {
    // Create the message object exactly as we would send it
    const message = {
      token: body.deviceToken || 'test_token_dry_run',
      notification: {
        title: body.title || 'Dry Run Test Title',
        body: body.body || 'This is a dry run - no notification was sent',
      },
      data: body.data || { dry_run: 'true', timestamp: new Date().toISOString() },
    };

    return {
      success: true,
      message: '✅ Dry run successful - Firebase message prepared',
      data: {
        preparedMessage: message,
        firebaseProject: process.env.FIREBASE_PROJECT_ID,
        wouldSendTo: body.deviceToken ? 'Real device' : 'Test device',
        actualSend: false,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      success: false,
      message: '❌ Dry run failed',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }

}
}