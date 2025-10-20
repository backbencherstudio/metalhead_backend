import { Injectable } from '@nestjs/common';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import appConfig from '../../../config/app.config';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import { DateHelper } from '../../../common/helper/date.helper';
import { MessageGateway } from '../message/message.gateway';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChatNotificationService } from '../chat-notification.service';

@Injectable()
export class ConversationService {
  constructor(
    private prisma: PrismaService,
    private readonly messageGateway: MessageGateway,
    private readonly chatNotificationService: ChatNotificationService,
  ) {}

  async create(createConversationDto: CreateConversationDto) {
    try {
      const data: any = {};

      if (createConversationDto.creator_id) {
        data.creator_id = createConversationDto.creator_id;
      }
      if (createConversationDto.participant_id) {
        data.participant_id = createConversationDto.participant_id;
      }

      // check if conversation exists
      let conversation = await this.prisma.conversation.findFirst({
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          created_at: true,
          updated_at: true,
          creator: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          participant: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          messages: {
            orderBy: {
              created_at: 'desc',
            },
            take: 1,
            select: {
              id: true,
              message: true,
              created_at: true,
            },
          },
        },
        where: {
          creator_id: data.creator_id,
          participant_id: data.participant_id,
        },
      });

      if (conversation) {
        return {
          success: false,
          message: 'Conversation already exists',
          data: conversation,
        };
      }

      conversation = await this.prisma.conversation.create({
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          created_at: true,
          updated_at: true,
          creator: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          participant: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          messages: {
            orderBy: {
              created_at: 'desc',
            },
            take: 1,
            select: {
              id: true,
              message: true,
              created_at: true,
            },
          },
        },
        data: {
          ...data,
        },
      });

      // add image url
      if (conversation.creator.avatar) {
        conversation.creator['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + conversation.creator.avatar,
        );
      }
      if (conversation.participant.avatar) {
        conversation.participant['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + conversation.participant.avatar,
        );
      }

      // trigger socket event
      this.messageGateway.server.to(data.creator_id).emit('conversation', {
        from: data.creator_id,
        data: conversation,
      });
      this.messageGateway.server.to(data.participant_id).emit('conversation', {
        from: data.participant_id,
        data: conversation,
      });

      // Send notification to participant about new conversation
      await this.chatNotificationService.notifyNewConversation({
        creatorId: data.creator_id,
        participantId: data.participant_id,
        conversationId: conversation.id,
      });

      return {
        success: true,
        message: 'Conversation created successfully',
        data: conversation,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Create or fetch a conversation for a confirmed job between job owner and accepted helper
   */
  async createFromJob(job_id: string) {
    try {
      // find confirmed job with accepted offer
      const job = await this.prisma.job.findFirst({
        where: { id: job_id, deleted_at: null },
        include: {
          accepted_counter_offer: {
            select: { helper_id: true },
          },
          assigned_helper: {
            select: { id: true },
          },
          user: { select: { id: true } },
        },
      });

      if (!job) {
        throw new NotFoundException('Job not found');
      }
      if (job.job_status !== 'confirmed' && job.job_status !== 'ongoing') {
        throw new ForbiddenException('Chat is only available for confirmed/ongoing jobs');
      }

      const helperId = job.accepted_counter_offer?.helper_id || job.assigned_helper_id;
      const ownerId = job.user_id;
      if (!helperId || !ownerId) {
        throw new ForbiddenException('No accepted helper for this job');
      }

      // check existing both directions
      let conversation = await this.prisma.conversation.findFirst({
        where: {
          OR: [
            { creator_id: ownerId, participant_id: helperId },
            { creator_id: helperId, participant_id: ownerId },
          ],
        },
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          created_at: true,
          updated_at: true,
          creator: { select: { id: true, name: true, avatar: true } },
          participant: { select: { id: true, name: true, avatar: true } },
        },
      });

      if (conversation) {
        // add avatar urls
        if (conversation.creator?.avatar) {
          conversation.creator['avatar_url'] = SojebStorage.url(
            appConfig().storageUrl.avatar + conversation.creator.avatar,
          );
        }
        if (conversation.participant?.avatar) {
          conversation.participant['avatar_url'] = SojebStorage.url(
            appConfig().storageUrl.avatar + conversation.participant.avatar,
          );
        }
        return { success: true, data: conversation };
      }

      // create new
      conversation = await this.prisma.conversation.create({
        data: { creator_id: ownerId, participant_id: helperId },
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          created_at: true,
          updated_at: true,
          creator: { select: { id: true, name: true, avatar: true } },
          participant: { select: { id: true, name: true, avatar: true } },
        },
      });

      // add avatar urls
      if (conversation.creator?.avatar) {
        conversation.creator['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + conversation.creator.avatar,
        );
      }
      if (conversation.participant?.avatar) {
        conversation.participant['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + conversation.participant.avatar,
        );
      }

      // notify both users
      this.messageGateway.server.to(ownerId).emit('conversation', {
        from: ownerId,
        data: conversation,
      });
      this.messageGateway.server.to(helperId).emit('conversation', {
        from: helperId,
        data: conversation,
      });

      // Send notification to helper about new conversation
      await this.chatNotificationService.notifyNewConversation({
        creatorId: ownerId,
        participantId: helperId,
        conversationId: conversation.id,
      });

      return { success: true, message: 'Conversation created', data: conversation };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async findAll() {
    try {
      const conversations = await this.prisma.conversation.findMany({
        orderBy: {
          updated_at: 'desc',
        },
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          created_at: true,
          updated_at: true,
          creator: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          participant: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          messages: {
            orderBy: {
              created_at: 'desc',
            },
            take: 1,
            select: {
              id: true,
              message: true,
              created_at: true,
            },
          },
        },
      });

      // add image url
      for (const conversation of conversations) {
        if (conversation.creator.avatar) {
          conversation.creator['avatar_url'] = SojebStorage.url(
            appConfig().storageUrl.avatar + conversation.creator.avatar,
          );
        }
        if (conversation.participant.avatar) {
          conversation.participant['avatar_url'] = SojebStorage.url(
            appConfig().storageUrl.avatar + conversation.participant.avatar,
          );
        }
      }

      return {
        success: true,
        data: conversations,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findOne(id: string) {
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id },
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          created_at: true,
          updated_at: true,
          creator: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          participant: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          messages: {
            orderBy: {
              created_at: 'asc',
            },
            select: {
              id: true,
              message: true,
              created_at: true,
              status: true,
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
          },
        },
      });

      if (!conversation) {
        return {
          success: false,
          message: 'Conversation not found',
        };
      }

      // add image url for creator and participant
      if (conversation.creator.avatar) {
        conversation.creator['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + conversation.creator.avatar,
        );
      }
      if (conversation.participant.avatar) {
        conversation.participant['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + conversation.participant.avatar,
        );
      }

      // enhance messages with proper sender/receiver info and attachment URLs
      for (const message of conversation.messages) {
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

        // Add attachment URL if exists
        if (msg.attachment) {
          msg.attachment['file_url'] = SojebStorage.url(
            appConfig().storageUrl.attachment + msg.attachment.file,
          );
        }
      }

      return {
        success: true,
        data: conversation,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async update(id: string, updateConversationDto: UpdateConversationDto) {
    try {
      const data = {};
      if (updateConversationDto.creator_id) {
        data['creator_id'] = updateConversationDto.creator_id;
      }
      if (updateConversationDto.participant_id) {
        data['participant_id'] = updateConversationDto.participant_id;
      }

      await this.prisma.conversation.update({
        where: { id },
        data: {
          ...data,
          updated_at: DateHelper.now(),
        },
      });

      return {
        success: true,
        message: 'Conversation updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.conversation.delete({
        where: { id },
      });

      return {
        success: true,
        message: 'Conversation deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async debugMessages(id: string) {
    try {
      // Get all messages for this conversation without any filtering
      const messages = await this.prisma.message.findMany({
        where: { 
          conversation_id: id,
          deleted_at: null 
        },
        orderBy: {
          created_at: 'asc',
        },
        select: {
          id: true,
          message: true,
          created_at: true,
          status: true,
          sender_id: true,
          receiver_id: true,
          conversation_id: true,
        },
      });

      // Also get conversation details
      const conversation = await this.prisma.conversation.findUnique({
        where: { id },
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          created_at: true,
        },
      });

      return {
        success: true,
        data: {
          conversation,
          messages,
          messageCount: messages.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
