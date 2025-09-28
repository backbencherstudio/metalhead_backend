import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationRepository } from '../../common/repository/notification/notification.repository';
import { NotificationGateway } from '../application/notification/notification.gateway';

@Injectable()
export class ChatNotificationService {
  private readonly logger = new Logger(ChatNotificationService.name);

  constructor(
    private prisma: PrismaService,
    private notificationGateway: NotificationGateway,
  ) {}

  /**
   * Send notification when a new message is received
   */
  async notifyNewMessage({
    senderId,
    receiverId,
    conversationId,
    messageText,
    messageType = 'text',
  }: {
    senderId: string;
    receiverId: string;
    conversationId: string;
    messageText?: string;
    messageType?: 'text' | 'image' | 'audio' | 'file';
  }) {
    try {
      // Get sender details
      const sender = await this.prisma.user.findUnique({
        where: { id: senderId },
        select: { id: true, name: true, username: true },
      });

      if (!sender) {
        this.logger.warn(`Sender not found: ${senderId}`);
        return;
      }

      // Create notification text based on message type
      let notificationText = '';
      const senderName = sender.name || sender.username || 'Someone';

      switch (messageType) {
        case 'text':
          notificationText = messageText 
            ? `${senderName}: ${messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText}`
            : `${senderName} sent you a message`;
          break;
        case 'image':
          notificationText = `${senderName} sent you an image`;
          break;
        case 'audio':
          notificationText = `${senderName} sent you a voice message`;
          break;
        case 'file':
          notificationText = `${senderName} sent you a file`;
          break;
        default:
          notificationText = `${senderName} sent you a message`;
      }

      // Create notification in database
      const notification = await NotificationRepository.createNotification({
        sender_id: senderId,
        receiver_id: receiverId,
        text: notificationText,
        type: 'message',
        entity_id: conversationId,
      });

      // Send real-time notification via WebSocket
      await this.notificationGateway.handleNotification({
        userId: receiverId,
        notification: {
          id: notification.id,
          text: notificationText,
          type: 'message',
          entity_id: conversationId,
          sender: {
            id: sender.id,
            name: sender.name,
            username: sender.username,
          },
          created_at: new Date(),
        },
      });

      this.logger.log(`Message notification sent to user ${receiverId} from ${senderId}`);
      return notification;
    } catch (error) {
      this.logger.error(`Error sending message notification: ${error.message}`);
    }
  }

  /**
   * Send notification when a new conversation is started
   */
  async notifyNewConversation({
    creatorId,
    participantId,
    conversationId,
  }: {
    creatorId: string;
    participantId: string;
    conversationId: string;
  }) {
    try {
      // Get creator details
      const creator = await this.prisma.user.findUnique({
        where: { id: creatorId },
        select: { id: true, name: true, username: true },
      });

      if (!creator) {
        this.logger.warn(`Creator not found: ${creatorId}`);
        return;
      }

      const creatorName = creator.name || creator.username || 'Someone';
      const notificationText = `${creatorName} started a conversation with you`;

      // Create notification in database
      const notification = await NotificationRepository.createNotification({
        sender_id: creatorId,
        receiver_id: participantId,
        text: notificationText,
        type: 'message',
        entity_id: conversationId,
      });

      // Send real-time notification via WebSocket
      await this.notificationGateway.handleNotification({
        userId: participantId,
        notification: {
          id: notification.id,
          text: notificationText,
          type: 'message',
          entity_id: conversationId,
          sender: {
            id: creator.id,
            name: creator.name,
            username: creator.username,
          },
          created_at: new Date(),
        },
      });

      this.logger.log(`Conversation notification sent to user ${participantId} from ${creatorId}`);
      return notification;
    } catch (error) {
      this.logger.error(`Error sending conversation notification: ${error.message}`);
    }
  }

  /**
   * Send notification when a file/attachment is sent
   */
  async notifyFileAttachment({
    senderId,
    receiverId,
    conversationId,
    fileName,
    fileType,
  }: {
    senderId: string;
    receiverId: string;
    conversationId: string;
    fileName: string;
    fileType: string;
  }) {
    try {
      // Get sender details
      const sender = await this.prisma.user.findUnique({
        where: { id: senderId },
        select: { id: true, name: true, username: true },
      });

      if (!sender) {
        this.logger.warn(`Sender not found: ${senderId}`);
        return;
      }

      const senderName = sender.name || sender.username || 'Someone';
      let notificationText = '';

      // Determine file type for notification
      if (fileType.startsWith('image/')) {
        notificationText = `${senderName} sent you an image: ${fileName}`;
      } else if (fileType.startsWith('audio/')) {
        notificationText = `${senderName} sent you a voice message`;
      } else {
        notificationText = `${senderName} sent you a file: ${fileName}`;
      }

      // Create notification in database
      const notification = await NotificationRepository.createNotification({
        sender_id: senderId,
        receiver_id: receiverId,
        text: notificationText,
        type: 'message',
        entity_id: conversationId,
      });

      // Send real-time notification via WebSocket
      await this.notificationGateway.handleNotification({
        userId: receiverId,
        notification: {
          id: notification.id,
          text: notificationText,
          type: 'message',
          entity_id: conversationId,
          sender: {
            id: sender.id,
            name: sender.name,
            username: sender.username,
          },
          created_at: new Date(),
        },
      });

      this.logger.log(`File attachment notification sent to user ${receiverId} from ${senderId}`);
      return notification;
    } catch (error) {
      this.logger.error(`Error sending file attachment notification: ${error.message}`);
    }
  }
}
