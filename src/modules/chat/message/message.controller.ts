import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  Delete,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  Get,
  Patch,
  UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MessageStatus } from '@prisma/client';
import appConfig from 'src/config/app.config';

@ApiBearerAuth()
@ApiTags('Message')
@UseGuards(JwtAuthGuard)
@Controller('chat/message')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'files', maxCount: 20 }, // all file types under "files"
      ],
      {
        storage: diskStorage({
          destination:
            appConfig().storageUrl.rootUrl + appConfig().storageUrl.attachment,
          filename: (req, file, cb) => {
            const randomName = Array(32)
              .fill(null)
              .map(() => Math.round(Math.random() * 16).toString(16))
              .join('');
   
            cb(
              null,
              `${randomName}${file.originalname.replace(/\s+/g, '-')}`,
            );
          },
        }),
   
        fileFilter: (req, file, cb) => {
          const allowedImage = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
          const allowedAudio = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg'];
          const allowedVideo = ['video/mp4', 'video/mpeg', 'video/webm', 'video/ogg'];
          const allowedPdf = ['application/pdf'];
          const allowedTxt = ['text/plain'];
   
          const allowed = [
            ...allowedImage,
            ...allowedAudio,
            ...allowedVideo,
            ...allowedPdf,
            ...allowedTxt,
          ];
   
          if (!allowed.includes(file.mimetype)) {
            return cb(new Error('Invalid file type'), false);
          }
   
          // SIZE LIMITS
          const maxSize = {
            image: 5 * 1024 * 1024,   // 5MB
            audio: 20 * 1024 * 1024,  // 20MB
            video: 50 * 1024 * 1024,  // 50MB
            pdf: 10 * 1024 * 1024,    // 10MB
            txt: 1 * 1024 * 1024,     // 1MB
          };
   
          if (file.mimetype.startsWith('image/') && file.size > maxSize.image) {
            return cb(new Error('Image size must not exceed 5MB'), false);
          }
   
          if (file.mimetype.startsWith('audio/') && file.size > maxSize.audio) {
            return cb(new Error('Audio size must not exceed 20MB'), false);
          }
   
          if (file.mimetype.startsWith('video/') && file.size > maxSize.video) {
            return cb(new Error('Video size must not exceed 50MB'), false);
          }
   
          if (file.mimetype === 'application/pdf' && file.size > maxSize.pdf) {
            return cb(new Error('PDF size must not exceed 10MB'), false);
          }
   
          if (file.mimetype === 'text/plain' && file.size > maxSize.txt) {
            return cb(new Error('TXT file must not exceed 1MB'), false);
          }
   
          cb(null, true);
        },
      },
    ),
  )
  async createMessage(
    @Req() req: Request,
    @Body() body: {
      receiver_id: string;
      conversation_id: string;
      message?: string;
    },
    @UploadedFiles() files
  ) {
    const userId = req.user.userId;
    
    return await this.messageService.createMessageWithFile(userId, body, files?.files||[]);
  }

  @ApiOperation({ summary: 'Get messages from a conversation' })
  @Get('conversation/:conversationId')
  async getMessages(
    @Req() req: Request,
    @Param('conversationId') conversationId: string,
    @Query('limit') limit?: number,
    @Query('page') page?: number,
  ) {
    const userId = req.user.userId;
    return await this.messageService.getMessages(userId, conversationId, limit, page);
  }

  @ApiOperation({ summary: 'Get message by ID' })
  @Get(':messageId')
  async getMessage(
    @Req() req: Request,
    @Param('messageId') messageId: string,
  ) {
    const userId = req.user.userId;
    return await this.messageService.getMessage(userId, messageId);
  }

  @ApiOperation({ summary: 'Mark message as read' })
  @Patch(':messageId/read')
  async markAsRead(
    @Req() req: Request,
    @Param('messageId') messageId: string,
  ) {
    const userId = req.user.userId;
    return await this.messageService.markAsRead(userId, messageId);
  }

  @ApiOperation({ summary: 'Update message status' })
  @Patch(':messageId/status')
  async updateStatus(
    @Req() req: Request,
    @Param('messageId') messageId: string,
    @Body() body: { status: MessageStatus },
  ) {
    const userId = req.user.userId;
    return await this.messageService.updateMessageStatus(userId, messageId, body.status);
  }

  @ApiOperation({ summary: 'Search messages' })
  @Get('search')
  async searchMessages(
    @Req() req: Request,
    @Query('q') query: string,
    @Query('conversationId') conversationId?: string,
    @Query('limit') limit?: number,
  ) {
    const userId = req.user.userId;
    return await this.messageService.searchMessages(userId, query, conversationId, limit);
  }

  @ApiOperation({ summary: 'Delete message (for current user or both users)' })
  @Delete(':messageId')
  async deleteMessage(
    @Req() req: Request,
    @Param('messageId') messageId: string,
    @Query('deleteForAll') deleteForAll?: boolean,
  ) {
    const userId = req.user.userId;
    return await this.messageService.deleteMessage(userId, messageId, deleteForAll);
  }
}
