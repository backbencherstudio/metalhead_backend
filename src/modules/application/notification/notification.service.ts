import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import appConfig from '../../../config/app.config';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  async create(createNotificationDto: CreateNotificationDto) {
    // This would typically be called by other services, not directly by users
    return 'Notification creation is handled by the system automatically';
  }

  async findAll(userId: string) {
    try {
      const notifications = await this.prisma.notification.findMany({
        where: {
          receiver_id: userId,
        },
        select: {
          id: true,
          sender_id: true,
          receiver_id: true,
          entity_id: true,
          read_at: true,
          created_at: true,
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          notification_event: {
            select: {
              id: true,
              type: true,
              text: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      // Add avatar URLs
      if (notifications.length > 0) {
        for (const notification of notifications) {
          if (notification.sender && notification.sender.avatar) {
            notification.sender['avatar_url'] = SojebStorage.url(
              appConfig().storageUrl.avatar + notification.sender.avatar,
            );
          }

          if (notification.receiver && notification.receiver.avatar) {
            notification.receiver['avatar_url'] = SojebStorage.url(
              appConfig().storageUrl.avatar + notification.receiver.avatar,
            );
          }
        }
      }

      return {
        success: true,
        data: notifications,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findOne(id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      include: {
        sender: true,
        receiver: true,
        notification_event: true,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  async update(id: string, updateNotificationDto: UpdateNotificationDto) {
    // Mark notification as read
    if (updateNotificationDto.read_at) {
      return this.prisma.notification.update({
        where: { id },
        data: { read_at: new Date() },
      });
    }

    // For other updates, only update specific fields
    const updateData: any = {};
    if (updateNotificationDto.sender_id !== undefined) {
      updateData.sender_id = updateNotificationDto.sender_id;
    }
    if (updateNotificationDto.receiver_id !== undefined) {
      updateData.receiver_id = updateNotificationDto.receiver_id;
    }
    if (updateNotificationDto.entity_id !== undefined) {
      updateData.entity_id = updateNotificationDto.entity_id;
    }

    return this.prisma.notification.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, userId: string) {
    try {
      // Check if notification exists and belongs to user
      const notification = await this.prisma.notification.findUnique({
        where: {
          id: id,
          receiver_id: userId,
        },
      });

      if (!notification) {
        return {
          success: false,
          message: 'Notification not found or you do not have permission to delete it',
        };
      }

      await this.prisma.notification.delete({
        where: { id },
      });

      return {
        success: true,
        message: 'Notification deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async removeAll(userId: string) {
    try {
      // Delete all notifications for the user
      const result = await this.prisma.notification.deleteMany({
        where: {
          receiver_id: userId,
        },
      });

      return {
        success: true,
        message: `${result.count} notifications deleted successfully`,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
