import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  Get,
  Query,
} from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateAttachmentMessageDto, CreateMessageDto } from './dto/create-message.dto';
import { MessageGateway } from './message.gateway';
import { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { UseInterceptors, UploadedFile } from '@nestjs/common';

@ApiBearerAuth()
@ApiTags('Message')
@UseGuards(JwtAuthGuard)
@Controller('chat/message')
export class MessageController {
  constructor(
    private readonly messageService: MessageService,
    private readonly messageGateway: MessageGateway,
  ) {}

  @ApiOperation({ summary: 'Send message' })
  @Post()
  async create(
    @Req() req: Request,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    const user_id = req.user.userId;
    const message = await this.messageService.create(user_id, createMessageDto);
    if (message.success) {
      const messageData = {
        message: {
          id: message.data.id,
          message_id: message.data.id,
          body_text: message.data.message,
          conversation_id: message.data.conversation_id,
          created_at: message.data.created_at,
          status: message.data.status,
          sender: message.data.sender,
          receiver: message.data.receiver,
          attachment: (message.data as any).attachment || null,
        },
      };
      this.messageGateway.server
        .to(message.data.conversation_id)
        .emit('message', {
          from: message.data.sender.id,
          data: messageData,
        });
      return {
        success: message.success,
        message: message.message,
        data: message.data,
      };
    } else {
      return {
        success: message.success,
        message: message.message,
      };
    }
  }

  @ApiOperation({ summary: 'Get all messages' })
  @Get()
  async findAll(
    @Req() req: Request,
    @Query()
    query: { conversation_id: string; limit?: number; cursor?: string },
  ) {
    const user_id = req.user.userId;
    const conversation_id = query.conversation_id as string;
    const limit = Number(query.limit);
    const cursor = query.cursor as string;
    try {
      const messages = await this.messageService.findAll({
        user_id,
        conversation_id,
        limit,
        cursor,
      });
      return messages;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Send attachment (image/audio) message' })
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', { storage: multer.memoryStorage() as any }) as any,
  )
  async upload(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CreateAttachmentMessageDto,
  ) {
    try {
      if (!file) {
        return {
          success: false,
          message: 'No file uploaded',
        };
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'audio/mpeg', 'audio/wav', 'audio/ogg'];
      if (!allowedTypes.includes(file.mimetype)) {
        return {
          success: false,
          message: 'Invalid file type. Only images (JPEG, PNG, GIF) and audio files (MP3, WAV, OGG) are allowed.',
        };
      }

      // Validate file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        return {
          success: false,
          message: 'File size too large. Maximum size is 10MB.',
        };
      }

      const user_id = req.user.userId;
      return await this.messageService.createAttachmentMessage(user_id, body, file);
    } catch (error) {
      return {
        success: false,
        message: error.message || 'File upload failed',
      };
    }
  }
}
