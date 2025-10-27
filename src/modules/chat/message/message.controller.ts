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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MessageStatus } from '@prisma/client';

@ApiBearerAuth()
@ApiTags('Message')
@UseGuards(JwtAuthGuard)
@Controller('chat/message')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async createMessage(
    @Req() req: Request,
    @Body() body: {
      receiver_id: string;
      conversation_id: string;
      message?: string;
    },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const userId = req.user.userId;
    return await this.messageService.createMessageWithFile(userId, body, file);
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
