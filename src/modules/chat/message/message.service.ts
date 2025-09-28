import { Injectable } from '@nestjs/common';
import { MessageStatus } from '@prisma/client';
import appConfig from '../../../config/app.config';
import { CreateMessageDto } from './dto/create-message.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { ChatRepository } from '../../../common/repository/chat/chat.repository';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import { DateHelper } from '../../../common/helper/date.helper';
import { MessageGateway } from './message.gateway';
import { UserRepository } from '../../../common/repository/user/user.repository';
import { Role } from '../../../common/guard/role/role.enum';
import { StringHelper } from '../../../common/helper/string.helper';
import { CreateAttachmentMessageDto } from './dto/create-message.dto';
import { ChatNotificationService } from '../chat-notification.service';

@Injectable()
export class MessageService {
  constructor(
    private prisma: PrismaService,
    private readonly messageGateway: MessageGateway,
    private readonly chatNotificationService: ChatNotificationService,
  ) {}

  async create(user_id: string, createMessageDto: CreateMessageDto) {
    try {
      const data: any = {};

      if (createMessageDto.conversation_id) {
        data.conversation_id = createMessageDto.conversation_id;
      }

      if (createMessageDto.receiver_id) {
        data.receiver_id = createMessageDto.receiver_id;
      }

      if (createMessageDto.message) {
        data.message = createMessageDto.message;
      }

      // check if conversation exists and sender/receiver are participants
      const conversation = await this.prisma.conversation.findFirst({
        where: { id: data.conversation_id },
        select: { id: true, creator_id: true, participant_id: true },
      });

      if (!conversation) {
        return {
          success: false,
          message: 'Conversation not found',
        };
      }

      // check if receiver exists
      const receiver = await this.prisma.user.findFirst({ where: { id: data.receiver_id } });
      
      // validate sender/receiver are within conversation
      const participants = [conversation.creator_id, conversation.participant_id];
      if (!participants.includes(user_id) || !participants.includes(data.receiver_id)) {
        return { 
          success: false, 
          message: 'You are not part of this conversation'
        };
      }

      // ensure there is a confirmed/ongoing job linking these two users (owner/helper)
      const ownerId = conversation.creator_id;
      const otherId = conversation.participant_id;
      
      const maybeOwner = await this.prisma.user.findUnique({ where: { id: ownerId } });
      const maybeOther = await this.prisma.user.findUnique({ where: { id: otherId } });

      // check in both directions which one is job owner
      const confirmedJob = await this.prisma.job.findFirst({
        where: {
          deleted_at: null,
          job_status: { in: ['confirmed', 'ongoing'] },
          OR: [
            {
              user_id: ownerId,
              accepted_offers: {
                some: { counter_offer: { helper_id: otherId } },
              },
            },
            {
              user_id: otherId,
              accepted_offers: {
                some: { counter_offer: { helper_id: ownerId } },
              },
            },
          ],
        },
        select: { id: true, job_status: true },
      });

      if (!confirmedJob) {
        return {
          success: false,
          message: 'Chat is only allowed for confirmed/ongoing jobs between these users',
        };
      }

      if (!receiver) {
        return {
          success: false,
          message: 'Receiver not found',
        };
      }

      const message = await this.prisma.message.create({
        data: {
          ...data,
          status: MessageStatus.SENT,
          sender_id: user_id,
        },
      });

      // Get comprehensive sender and receiver information
      const [senderInfo, receiverInfo] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: user_id },
          select: {
            id: true,
            name: true,
            username: true,
            type: true,
            avatar: true,
          },
        }),
        this.prisma.user.findUnique({
          where: { id: data.receiver_id },
          select: {
            id: true,
            name: true,
            username: true,
            type: true,
            avatar: true,
          },
        }),
      ]);

      // update conversation updated_at
      await this.prisma.conversation.update({
        where: {
          id: data.conversation_id,
        },
        data: {
          updated_at: DateHelper.now(),
        },
      });

      // Enhanced message data with sender and receiver info
      const enhancedMessage = {
        ...message,
        conversation_id: data.conversation_id,
        created_at: message.created_at,
        sender: {
          id: senderInfo.id,
          name: senderInfo.name || senderInfo.username || 'Unknown',
          username: senderInfo.username,
          role: senderInfo.type,
          avatar: senderInfo.avatar,
        },

        receiver: {
          id: receiverInfo.id,
          name: receiverInfo.name || receiverInfo.username || 'Unknown',
          username: receiverInfo.username,
          role: receiverInfo.type,
          avatar: receiverInfo.avatar,
        },
      };

      // Send notification to receiver
      await this.chatNotificationService.notifyNewMessage({
        senderId: user_id,
        receiverId: data.receiver_id,
        conversationId: data.conversation_id,
        messageText: data.message,
        messageType: 'text',
      });

      return {
        success: true,
        data: enhancedMessage,
        message: 'Message sent successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findAll({
    user_id,
    conversation_id,
    limit = 20,
    cursor,
  }: {
    user_id: string;
    conversation_id: string;
    limit?: number;
    cursor?: string;
  }) {
    try {
      const userDetails = await UserRepository.getUserDetails(user_id);

      const where_condition = {
        AND: [{ id: conversation_id }],
      };

      if (userDetails.type != Role.ADMIN) {
        where_condition['OR'] = [
          { creator_id: user_id },
          { participant_id: user_id },
        ];
      }

      const conversation = await this.prisma.conversation.findFirst({
        where: {
          ...where_condition,
        },
      });

      if (!conversation) {
        return {
          success: false,
          message: 'Conversation not found',
        };
      }

      // Fix pagination logic
      const paginationData: any = {};
      if (limit) {
        paginationData['take'] = limit;
      }
      if (cursor) {
        paginationData['skip'] = 1; // Skip the cursor message
        paginationData['cursor'] = { id: cursor };
      }

      const messages = await this.prisma.message.findMany({
        ...paginationData,
        where: {
          conversation_id: conversation_id,
        },
        orderBy: {
          created_at: 'asc',
        },
        select: {
          id: true,
          message: true,
          created_at: true,
          status: true,
          conversation_id: true,
          sender: {
            select: {
              id: true,
              name: true,
              username: true,
              type: true,
              avatar: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              username: true,
              type: true,
              avatar: true,
            },
          },
          attachment: {
            select: {
              id: true,
              name: true,
              type: true,
              size: true,
              file: true,
            },
          },
        },
      });

      // add attachment url
      for (const message of messages) {
        const msg = message as any;
        if (msg.attachment) {
          msg.attachment['file_url'] = SojebStorage.url(
            appConfig().storageUrl.attachment + msg.attachment.file,
          );
        }
      }

      // enhance message data with proper sender/receiver info
      for (const message of messages) {
        const msg = message as any;
        
        // Enhance sender info
        if (msg.sender) {
          msg.sender = {
            id: msg.sender.id,
            name: msg.sender.name || msg.sender.username || 'Unknown',
            username: msg.sender.username,
            role: msg.sender.type,
            avatar: msg.sender.avatar,
            avatar_url: msg.sender.avatar ? SojebStorage.url(
              appConfig().storageUrl.avatar + msg.sender.avatar,
            ) : null,
          };
        }
        
        // Enhance receiver info
        if (msg.receiver) {
          msg.receiver = {
            id: msg.receiver.id,
            name: msg.receiver.name || msg.receiver.username || 'Unknown',
            username: msg.receiver.username,
            role: msg.receiver.type,
            avatar: msg.receiver.avatar,
            avatar_url: msg.receiver.avatar ? SojebStorage.url(
              appConfig().storageUrl.avatar + msg.receiver.avatar,
            ) : null,
          };
        }
      }

      return {
        success: true,
        data: messages,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async updateMessageStatus(message_id: string, status: MessageStatus) {
    return await ChatRepository.updateMessageStatus(message_id, status);
  }

  async readMessage(message_id: string) {
    return await ChatRepository.updateMessageStatus(
      message_id,
      MessageStatus.READ,
    );
  }

  async updateUserStatus(user_id: string, status: string) {
    return await ChatRepository.updateUserStatus(user_id, status);
  }

  async createAttachmentMessage(
    user_id: string,
    dto: CreateAttachmentMessageDto,
    file: Express.Multer.File,
  ) {
    try {
      if (!file) {
        return { success: false, message: 'No file uploaded' };
      }

      // Validate conversation and participants (reuse validation logic from create method)
      const conversation = await this.prisma.conversation.findFirst({
        where: { id: dto.conversation_id },
        select: { creator_id: true, participant_id: true },
      });

      if (!conversation) {
        return { success: false, message: 'Conversation not found' };
      }

      // check if receiver exists
      const receiver = await this.prisma.user.findFirst({ where: { id: dto.receiver_id } });
      if (!receiver) {
        return { success: false, message: 'Receiver not found' };
      }

      // validate sender/receiver are within conversation
      const participants = [conversation.creator_id, conversation.participant_id];
      if (!participants.includes(user_id) || !participants.includes(dto.receiver_id)) {
        return { success: false, message: 'You are not part of this conversation' };
      }

      // ensure there is a confirmed/ongoing job linking these two users (owner/helper)
      const ownerId = conversation.creator_id;
      const otherId = conversation.participant_id;

      // check in both directions which one is job owner
      const confirmedJob = await this.prisma.job.findFirst({
        where: {
          deleted_at: null,
          job_status: { in: ['confirmed', 'ongoing'] },
          OR: [
            {
              user_id: ownerId,
              accepted_offers: {
                some: { counter_offer: { helper_id: otherId } },
              },
            },
            {
              user_id: otherId,
              accepted_offers: {
                some: { counter_offer: { helper_id: ownerId } },
              },
            },
          ],
        },
        select: { id: true },
      });

      if (!confirmedJob) {
        return {
          success: false,
          message: 'Chat is only allowed for confirmed/ongoing jobs between these users',
        };
      }

      // store file
      const fileName = `${StringHelper.randomString()}_${dto.name || file.originalname}`;
      await SojebStorage.put(
        appConfig().storageUrl.attachment + '/' + fileName,
        file.buffer,
      );

      // create attachment row
      const attachment = await this.prisma.attachment.create({
        data: {
          name: dto.name || file.originalname,
          type: dto.type || file.mimetype,
          size: file.size,
          file: fileName,
        },
      });

      // create message that references attachment
      const message = await this.prisma.message.create({
        data: {
          conversation_id: dto.conversation_id,
          receiver_id: dto.receiver_id,
          sender_id: user_id,
          status: MessageStatus.SENT,
          attachment_id: attachment.id,
          message: dto.message,
        },
      });

      // Get comprehensive sender and receiver information
      const [senderInfo, receiverInfo] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: user_id },
          select: {
            id: true,
            name: true,
            username: true,
            type: true,
            avatar: true,
          },
        }),
        this.prisma.user.findUnique({
          where: { id: dto.receiver_id },
          select: {
            id: true,
            name: true,
            username: true,
            type: true,
            avatar: true,
          },
        }),
      ]);

      // bump conversation update time
      await this.prisma.conversation.update({
        where: { id: dto.conversation_id },
        data: { updated_at: DateHelper.now() },
      });

      // Enhanced message data with sender and receiver info
      const enhancedMessage = {
        ...message,
        conversation_id: dto.conversation_id,
        created_at: message.created_at,
        sender: {
          id: senderInfo.id,
          name: senderInfo.name || senderInfo.username || 'Unknown',
          username: senderInfo.username,
          role: senderInfo.type,
          avatar: senderInfo.avatar,
        },
        receiver: {
          id: receiverInfo.id,
          name: receiverInfo.name || receiverInfo.username || 'Unknown',
          username: receiverInfo.username,
          role: receiverInfo.type,
          avatar: receiverInfo.avatar,
        },
        attachment: {
          id: attachment.id,
          name: attachment.name,
          type: attachment.type,
          size: attachment.size,
          file: attachment.file,
          file_url: SojebStorage.url(appConfig().storageUrl.attachment + '/' + attachment.file),
        },
      };

      // Send notification to receiver
      await this.chatNotificationService.notifyFileAttachment({
        senderId: user_id,
        receiverId: dto.receiver_id,
        conversationId: dto.conversation_id,
        fileName: dto.name,
        fileType: file.mimetype,
      });

      return { success: true, message: 'Attachment sent', data: enhancedMessage };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}
