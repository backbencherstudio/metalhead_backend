import { Controller, Get, Post, Body, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Request } from 'express';

@ApiBearerAuth()
@ApiTags('User Notifications')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @ApiOperation({ summary: 'Get all notifications for current user' })
  @Get()
  async findAll(@Req() req: Request) {
    try {
      const userId = (req as any).user.userId || (req as any).user.id;
      const notifications = await this.notificationService.findAll(userId);
      return notifications;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Create a new notification' })
  @Post()
  async create(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationService.create(createNotificationDto);
  }

  @ApiOperation({ summary: 'Delete a notification' })
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    try {
      const userId = (req as any).user.userId || (req as any).user.id;
      const result = await this.notificationService.remove(id, userId);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Delete all notifications for current user' })
  @Delete()
  async removeAll(@Req() req: Request) {
    try {
      const userId = (req as any).user.userId || (req as any).user.id;
      const result = await this.notificationService.removeAll(userId);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
