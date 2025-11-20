import { Injectable } from '@nestjs/common';
import { MessageStatus } from '@prisma/client';
import { CreateMessageDto } from './dto/create-message.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import { DateHelper } from '../../../common/helper/date.helper';
import { StringHelper } from '../../../common/helper/string.helper';
import { ChatNotificationService } from '../chat-notification.service';
import { MessageGateway } from './message.gateway';
import { v4 as uuidv4 } from 'uuid';
import appConfig from '../../../config/app.config';

@Injectable()
export class MessageService {
  constructor(
    private prisma: PrismaService,
    private readonly chatNotificationService: ChatNotificationService,
    private readonly messageGateway: MessageGateway,
  ) {}

  async createMessageWithFile(
    userId: string,
    body: { receiver_id: string; conversation_id: string; message?: string },
    files?: Express.Multer.File[], // Expecting an array of files
  ) {
    const prisma = this.prisma; // For convenience
    const transactionData = [];

    try {
      // 1. Validate conversation and participants
      // const validation = await this.validateConversationAndParticipants(
      //   userId,
      //   body.conversation_id,
      //   body.receiver_id,
      // );

      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: body.conversation_id,
          OR: [{ creator_id: userId }, { participant_id: userId }],
        },
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          is_deleted_by_creator: true,
          is_deleted_by_participant: true,
        },
      });

      if (!conversation) {
        return { success: false, message: 'Conversation not found' };
      }

      const receiver = await this.prisma.user.findFirst({
        where: { id: body.receiver_id },
      });

      if (!receiver) {
        return { success: false, message: 'Receiver not found' };
      }

      // 2. Start a transaction
      const result = await prisma.$transaction(async (prisma) => {
        // 2.1 Create message within the transaction
        const message = await prisma.message.create({
          data: {
            conversation_id: body.conversation_id,
            receiver_id: body.receiver_id,
            sender_id: userId,
            message: body.message,
            status: MessageStatus.SENT,
          },
        });

        // 2.2 Handle file uploads (multiple files)
        let attachments = [];
        if (files && files.length > 0) {
          for (const file of files) {
            // {
            //   "fieldname": "files",
            //   "originalname": "Ali Imam Hridoy.png",
            //   "encoding": "7bit",
            //   "mimetype": "image/png",
            //   "destination": "./public/storage/attachment",
            //   "filename": "5decb9108843b29912bf62c26523999e9Ali-Imam-Hridoy.png",
            //   "path": "public\\storage\\attachment\\5decb9108843b29912bf62c26523999e9Ali-Imam-Hridoy.png",
            //   "size": 1108266
            // },

            // Create attachment record and push it into the transaction
            const attachment = await prisma.attachment.create({
              data: {
                message_id: message.id, // Link the attachment to the message
                sender_id: userId,
                name: file.originalname,
                type: file.mimetype,
                size: file.size,
                file: file.filename,
              },
            });

            attachment['file_url'] = SojebStorage.url(
              appConfig().storageUrl.attachment + '/' + attachment.file,
            );

            attachments.push(attachment);
          }
        }

        // Return both the created message and attachments as part of the transaction result
        return { message, attachments };
      });

      this.messageGateway.server
        .to(result.message.sender_id)
        .emit('newMessage', result);
      this.messageGateway.server
        .to(result.message.receiver_id)
        .emit('newMessage', result);

      const updatedConversation = await prisma.conversation.update({
        where: { id: body.conversation_id },
        data: {
          is_deleted_by_creator: false,
          is_deleted_by_participant: false,
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
              username: true,
              avatar: true,
              availability:true,
            }
          },
          participant: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
              availability:true,
            }
          },
          messages:{
           take:1, 
           orderBy:{
            created_at:'desc'
           },
           include:{
            attachments:true
           }
          }
        }
      });

      if (conversation.is_deleted_by_creator) {
        this.messageGateway.server
          .to(conversation.creator_id)
          .emit('conversationUpdated', updatedConversation);
      }

      if (conversation.is_deleted_by_participant) {
        this.messageGateway.server
          .to(conversation.participant_id)
          .emit('conversationUpdated', updatedConversation);
      }
      return {
        success: true,
        message: 'Message and attachments created successfully',
        data: result,
      };
    } catch (error) {
      // 4. If there is any error, Prisma will automatically roll back the transaction
      return {
        success: false,
        message:
          error.message ||
          'An error occurred while creating the message and attachments',
      };
    }
  }

  async getMessages(
    userId: string,
    conversationId: string,
    limit: number = 20,
    page: number = 1,
  ) {
    try {
      // 1. Validate user is part of conversation
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          OR: [{ creator_id: userId }, { participant_id: userId }],
        },
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          is_deleted_by_creator: true,
          is_deleted_by_participant: true,
          deleted_by_creator: true,
          deleted_by_participant: true,
        },
      });

      if (!conversation) {
        return {
          success: false,
          message: 'Conversation not found or you are not part of it',
        };
      }

      const isCreator = conversation.creator_id === userId;
      const isParticipant = conversation.participant_id === userId;

      // console.log(isCreator, isParticipant);
      // console.log(
      //   conversation.is_deleted_by_creator,
      //   conversation.is_deleted_by_participant,
      // );
      // console.log(
      //   conversation.deleted_by_creator,
      //   conversation.deleted_by_participant,
      // );

      // if(isCreator && conversation.is_deleted_by_creator){
      //   const deletedAt = conversation.deleted_by_creator;
      //   const messages = await this.prisma.message.findMany({
      //     where: {
      //       conversation_id: conversationId,
      //       created_at: {
      //         gte: deletedAt,
      //       },
      //       // AND: [
      //       //   {
      //       //     OR: [
      //       //       { sender_id: userId },
      //       //       { receiver_id: userId },
      //       //     ],
      //       //   },
      //       // ],
      //     },
      //   });
      //   return { success: true, data: messages };
      // }
      // else if(isParticipant && conversation.is_deleted_by_participant){
      //   const deletedAt = conversation.deleted_by_participant;
      //   const messages = await this.prisma.message.findMany({
      //     where: {
      //       conversation_id: conversationId,
      //       created_at: {
      //         gte: deletedAt,
      //       },
      //       // AND: [
      //       //   {
      //       //     OR: [
      //       //       { sender_id: userId },
      //       //       { receiver_id: userId },
      //       //     ],
      //       //   },
      //       // ],
      //     },
      //   });
      //   return { success: true, data: messages };
      // }

      let whereClauses = {
        conversation_id: conversationId,
      };
      if (isCreator && conversation.deleted_by_creator) {
        whereClauses['created_at'] = {
          gte: conversation.deleted_by_creator,
        };
      } else if (isParticipant && conversation.deleted_by_participant) {
        whereClauses['created_at'] = {
          gte: conversation.deleted_by_participant,
        };
      }

      // console.log(whereClauses);

      const msgs = await this.prisma.message.findMany({
        where: whereClauses,
      });
      const totalPages = Math.ceil(msgs.length / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;
      const skip = (page - 1) * limit;

      return { 
        success: true, 
        count: msgs.length, 
        data: msgs,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalCount: msgs.length,
          limit: limit,
          hasNextPage: hasNextPage,
          hasPrevPage: hasPrevPage,
        }, 
      };

      // 2. Calculate skip value for traditional pagination
      // const skip = (page - 1) * limit;

      // Build the where clause to filter messages based on per-user deletion
      const whereClause = {
        conversation_id: conversationId,
        deleted_at: null, // Exclude globally soft-deleted messages
        AND: [
          {
            OR: [
              // Show if user is sender and hasn't deleted it for sender
              {
                AND: [{ sender_id: userId }, { deleted_for_sender: null }],
              },
              // Show if user is receiver and hasn't deleted it for receiver
              {
                AND: [{ receiver_id: userId }, { deleted_for_receiver: null }],
              },
            ],
          },
        ],
      };

      // 3. Get total count for pagination info
      const totalCount = await this.prisma.message.count({
        where: whereClause,
      });

      // 4. Get messages with traditional pagination
      const messages = await this.prisma.message.findMany({
        skip: skip,
        take: limit,
        where: whereClause,
        orderBy: { created_at: 'asc' },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              username: true,
              type: true,
              avatar: true,
              availability: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              username: true,
              type: true,
              avatar: true,
              availability: true,
            },
          },
          attachments: {
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

      // 5. Get attachments for each message
      // const messagesWithAttachments = await Promise.all(
      //   messages.map(async (message) => {
      //     const attachments = await this.prisma.attachment.findMany({
      //       where: { message_id: message.id },
      //       select: {
      //         id: true,
      //         name: true,
      //         type: true,
      //         size: true,
      //         file: true,
      //       },
      //     });

      //     return {
      //       ...message,
      //       sender: {
      //         id: (message as any).sender?.id,
      //         name: (message as any).sender?.name || (message as any).sender.username || 'Unknown',
      //         username: (message as any).sender?.username,
      //         role: (message as any).sender?.type,
      //         avatar: (message as any).sender?.avatar,
      //         avatar_url: (message as any).sender?.avatar ?
      //           SojebStorage.url(appConfig().storageUrl.avatar + (message as any).sender.avatar) : null,
      //       },
      //       receiver: {
      //         id: (message as any).receiver?.id,
      //         name: (message as any).receiver?.name || (message as any).receiver?.username || 'Unknown',
      //         username: (message as any).receiver?.username,
      //         role: (message as any).receiver?.type,
      //         avatar: (message as any).receiver?.avatar,
      //         avatar_url: (message as any).receiver?.avatar ?
      //           SojebStorage.url(appConfig().storageUrl.avatar + (message as any).receiver.avatar) : null,
      //       },
      //       attachments: attachments.map(attachment => ({
      //         ...attachment,
      //         file_url: SojebStorage.url(attachment.file),
      //       })),
      //     };
      //   })
      // );

      // 6. Calculate pagination info
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getMessage(userId: string, messageId: string) {
    try {
      // 1. Find message and verify access
      const message = await this.prisma.message.findFirst({
        where: {
          id: messageId,
          deleted_at: null, // Exclude globally soft-deleted messages
          AND: [
            {
              OR: [
                // Show if user is sender and hasn't deleted it for sender
                { sender_id: userId, deleted_for_sender: null },
                // Show if user is receiver and hasn't deleted it for receiver
                { receiver_id: userId, deleted_for_receiver: null },
              ],
            },
          ],
        },
        include: {
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
        },
      });
      if (!message) {
        return { success: false, message: 'Message not found' };
      }

      // 2. Check if user has access to this message
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: message.conversation_id,
          OR: [{ creator_id: userId }, { participant_id: userId }],
        },
        select: { id: true, creator_id: true, participant_id: true },
      });

      if (!conversation) {
        return {
          success: false,
          message: 'You do not have access to this message',
        };
      }

      // 3. Get attachments
      const attachments = await this.prisma.attachment.findMany({
        where: { message_id: messageId },
        select: {
          id: true,
          name: true,
          type: true,
          size: true,
          file: true,
        },
      });

      // 4. Enhance message data
      const enhancedMessage = {
        ...message,
        sender: {
          id: (message as any).sender.id,
          name:
            (message as any).sender.name ||
            (message as any).sender.username ||
            'Unknown',
          username: (message as any).sender.username,
          role: (message as any).sender.type,
          avatar: (message as any).sender.avatar,
          avatar_url: (message as any).sender.avatar
            ? SojebStorage.url(
                appConfig().storageUrl.avatar + (message as any).sender.avatar,
              )
            : null,
        },
        receiver: {
          id: (message as any).receiver?.id,
          name:
            (message as any).receiver.name ||
            (message as any).receiver.username ||
            'Unknown',
          username: (message as any).receiver.username,
          role: (message as any).receiver.type,
          avatar: (message as any).receiver.avatar,
          avatar_url: (message as any).receiver.avatar
            ? SojebStorage.url(
                appConfig().storageUrl.avatar +
                  (message as any).receiver.avatar,
              )
            : null,
        },
        attachments: attachments.map((attachment) => ({
          ...attachment,
          file_url: SojebStorage.url(attachment.file),
        })),
      };

      return {
        success: true,
        data: enhancedMessage,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async markAsRead(userId: string, messageId: string) {
    try {
      // 1. Find message and verify access
      const message = await this.prisma.message.findFirst({
        where: {
          id: messageId,
          deleted_at: null,
        },
      });

      if (!message) {
        return { success: false, message: 'Message not found' };
      }

      // 2. Check if user is the receiver
      if (message.receiver_id !== userId) {
        return {
          success: false,
          message: 'You can only mark messages sent to you as read',
        };
      }

      // 3. Update message status to READ
      await this.prisma.message.update({
        where: { id: messageId },
        data: { status: MessageStatus.READ },
      });

      // 4. Emit WebSocket event for read receipt
      this.messageGateway.server
        .to(message.conversation_id)
        .emit('messageRead', {
          messageId: messageId,
          readBy: userId,
          readAt: new Date(),
        });

      return {
        success: true,
        message: 'Message marked as read',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async updateMessageStatus(
    userId: string,
    messageId: string,
    status: MessageStatus,
  ) {
    try {
      // 1. Find message and verify access
      const message = await this.prisma.message.findFirst({
        where: {
          id: messageId,
          deleted_at: null,
        },
      });

      if (!message) {
        return { success: false, message: 'Message not found' };
      }

      // 2. Check if user is sender or receiver
      const isSender = message.sender_id === userId;
      const isReceiver = message.receiver_id === userId;

      if (!isSender && !isReceiver) {
        return {
          success: false,
          message: 'You are not authorized to update this message',
        };
      }

      // 3. Update message status
      await this.prisma.message.update({
        where: { id: messageId },
        data: { status },
      });

      // 4. Emit WebSocket event
      this.messageGateway.server
        .to(message.conversation_id)
        .emit('messageStatusUpdated', {
          messageId: messageId,
          status: status,
          updatedBy: userId,
        });

      return {
        success: true,
        message: 'Message status updated',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async searchMessages(
    userId: string,
    query: string,
    conversationId?: string,
    limit: number = 20,
  ) {
    try {
      // 1. Build base search conditions
      const baseConditions: any = {
        deleted_at: null, // Exclude globally soft-deleted messages
        message: {
          contains: query,
          mode: 'insensitive',
        },
        // Filter out messages deleted by current user
        AND: [
          {
            OR: [
              // Show if user is sender and hasn't deleted it for sender
              { sender_id: userId, deleted_for_sender: null },
              // Show if user is receiver and hasn't deleted it for receiver
              { receiver_id: userId, deleted_for_receiver: null },
            ],
          },
        ],
      };

      // 2. If conversationId provided, validate access
      if (conversationId) {
        const conversation = await this.prisma.conversation.findFirst({
          where: {
            id: conversationId,
            OR: [{ creator_id: userId }, { participant_id: userId }],
          },
        });

        if (!conversation) {
          return {
            success: false,
            message: 'Conversation not found or you are not part of it',
          };
        }

        baseConditions.conversation_id = conversationId;
      } else {
        // If no conversationId, search in all user's conversations
        const userConversations = await this.prisma.conversation.findMany({
          where: {
            OR: [{ creator_id: userId }, { participant_id: userId }],
          },
          select: { id: true },
        });

        const conversationIds = userConversations.map((conv) => conv.id);
        baseConditions.conversation_id = { in: conversationIds };
      }

      // 3. Search messages
      const messages = await this.prisma.message.findMany({
        where: baseConditions,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
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
        },
      });

      // 4. Enhance messages with attachments
      const messagesWithAttachments = await Promise.all(
        messages.map(async (message) => {
          const attachments = await this.prisma.attachment.findMany({
            where: { message_id: message.id },
            select: {
              id: true,
              name: true,
              type: true,
              size: true,
              file: true,
            },
          });

          return {
            ...message,
            sender: {
              id: (message as any).sender.id,
              name:
                (message as any).sender.name ||
                (message as any).sender.username ||
                'Unknown',
              username: (message as any).sender.username,
              role: (message as any).sender.type,
              avatar: (message as any).sender.avatar,
              avatar_url: (message as any).sender.avatar
                ? SojebStorage.url(
                    appConfig().storageUrl.avatar +
                      (message as any).sender.avatar,
                  )
                : null,
            },
            receiver: {
              id: (message as any).receiver.id,
              name:
                (message as any).receiver.name ||
                (message as any).receiver.username ||
                'Unknown',
              username: (message as any).receiver.username,
              role: (message as any).receiver.type,
              avatar: (message as any).receiver.avatar,
              avatar_url: (message as any).receiver.avatar
                ? SojebStorage.url(
                    appConfig().storageUrl.avatar +
                      (message as any).receiver.avatar,
                  )
                : null,
            },
            attachments: attachments.map((attachment) => ({
              ...attachment,
              file_url: SojebStorage.url(attachment.file),
            })),
          };
        }),
      );

      return {
        success: true,
        data: messagesWithAttachments,
        query,
        total: messages.length,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async deleteMessage(
    userId: string,
    messageId: string,
    deleteForAll: boolean = false,
  ) {
    try {
      // 1. Find message and verify ownership
      const message = await this.prisma.message.findFirst({
        where: { id: messageId },
        include: {
          attachments: true,
        },
      });

      console.log(message);
      if (!message) {
        return { success: false, message: 'Message not found' };
      }

      // 2. Check if user is sender or receiver
      const isSender = message.sender_id === userId;
      const isReceiver = message.receiver_id === userId;

      if (!isSender && !isReceiver) {
        return {
          success: false,
          message: 'You are not authorized to delete this message',
        };
      }

      // 3. Delete logic based on deleteForAll flag
      if (deleteForAll) {
        // Delete for everyone (only sender can do this)
        if (!isSender) {
          return {
            success: false,
            message: 'Only sender can delete message for everyone',
          };
        }

        // Hard delete message and attachments (cascade will handle attachments)
        await this.prisma.message.delete({ where: { id: messageId } });

        return { success: true, message: 'Message deleted for everyone' };
      } else {
        // Delete for current user only - set the appropriate field
        const updateData: any = {};

        if (isSender) {
          updateData.deleted_for_sender = DateHelper.now();
        } else if (isReceiver) {
          updateData.deleted_for_receiver = DateHelper.now();
        }

        if (isSender && message.deleted_for_sender !== null) {
          return { success: false, message: 'Message already deleted for you' };
        }

        if (isReceiver && message.deleted_for_receiver !== null) {
          return { success: false, message: 'Message already deleted for you' };
        }

        await this.prisma.message.update({
          where: { id: messageId },
          data: updateData,
        });

        return { success: true, message: 'Message deleted for you' };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // Private helper methods
  private async validateConversationAndParticipants(
    userId: string,
    conversationId: string,
    receiverId: string,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ creator_id: userId }, { participant_id: userId }],
      },

      select: { id: true, creator_id: true, participant_id: true },
    });

    if (!conversation) {
      return { success: false, message: 'Conversation not found' };
    }

    const receiver = await this.prisma.user.findFirst({
      where: { id: receiverId },
    });
    if (!receiver) {
      return { success: false, message: 'Receiver not found' };
    }

    console.log();
    // Validate participants
    //   const participants = [conversation.creator_id, conversation.participant_id];
    // if (!participants.includes(userId) || !participants.includes(receiverId)) {
    //     return { success: false, message: 'You are not part of this conversation' };
    //   }

    // Validate job status
    const jobValidation = await this.validateJobStatus(
      conversation.creator_id,
      conversation.participant_id,
    );
    if (!jobValidation.success)
      return { ...jobValidation, conversation: conversation };

    return { success: true, conversation: conversation };
  }

  private async validateJobStatus(ownerId: string, otherId: string) {
    const confirmedJob = await this.prisma.job.findFirst({
      where: {
        deleted_at: null,
        job_status: { in: ['confirmed', 'ongoing'] },
        OR: [
          {
            user_id: ownerId,
            OR: [
              { accepted_counter_offer: { helper_id: otherId } },
              { assigned_helper_id: otherId },
            ],
          },
          {
            user_id: otherId,
            OR: [
              { accepted_counter_offer: { helper_id: ownerId } },
              { assigned_helper_id: ownerId },
            ],
          },
        ],
      },
      select: { id: true },
    });

    if (!confirmedJob) {
      return {
        success: false,
        message: 'Chat is only allowed for confirmed/ongoing jobs',
      };
    }

    return { success: true };
  }

  private async createAttachments(
    messageId: string,
    userId: string,
    attachments: any[],
  ) {
    const createdAttachments = [];

    for (const attachment of attachments) {
      // Validate file type and size
      const validation = this.validateFileType(attachment);
      if (!validation.success) {
        throw new Error(validation.message);
      }

      // Convert base64 to buffer and store file
      const fileName = `${StringHelper.randomString()}_${attachment.name}`;
      const fileBuffer = Buffer.from(attachment.content, 'base64');

      await SojebStorage.put(
        appConfig().storageUrl.attachment + '/' + fileName,
        fileBuffer,
      );

      // Create attachment record
      const createdAttachment = await this.prisma.attachment.create({
        data: {
          message_id: messageId,
          sender_id: userId,
          name: attachment.name,
          type: attachment.type,
          size: attachment.size || fileBuffer.length,
          file: fileName,
        },
      });

      createdAttachments.push({
        ...createdAttachment,
        file_url: SojebStorage.url(
          appConfig().storageUrl.attachment + '/' + fileName,
        ),
      });
    }

    return createdAttachments;
  }

  private validateFile(file: Express.Multer.File) {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/mp3',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return {
        success: false,
        message: 'Invalid file type. Only images and audio files are allowed.',
      };
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return {
        success: false,
        message: 'File size too large. Maximum size is 10MB.',
      };
    }

    return { success: true };
  }

  private validateFileType(attachment: any) {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/mp3',
    ];

    if (!allowedTypes.includes(attachment.type)) {
      return { success: false, message: 'Invalid file type' };
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (attachment.size && attachment.size > maxSize) {
      return { success: false, message: 'File size too large' };
    }

    return { success: true };
  }

  private async updateConversationTimestamp(conversationId: string) {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updated_at: DateHelper.now() },
    });
  }

  private async getEnhancedMessageData(messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
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
      },
    });

    // Get attachments separately
    const attachments = await this.prisma.attachment.findMany({
      where: { message_id: messageId },
      select: {
        id: true,
        name: true,
        type: true,
        size: true,
        file: true,
      },
    });

    // Enhance with URLs and formatted data
    return {
      ...message,
      sender: {
        id: message.sender.id,
        name: message.sender.name || message.sender.username || 'Unknown',
        username: message.sender.username,
        role: message.sender.type,
        avatar: message.sender.avatar,
        avatar_url: message.sender.avatar
          ? SojebStorage.url(
              appConfig().storageUrl.avatar + message.sender.avatar,
            )
          : null,
      },
      receiver: {
        id: message.receiver.id,
        name: message.receiver.name || message.receiver.username || 'Unknown',
        username: message.receiver.username,
        role: message.receiver.type,
        avatar: message.receiver.avatar,
        avatar_url: message.receiver.avatar
          ? SojebStorage.url(
              appConfig().storageUrl.avatar + message.receiver.avatar,
            )
          : null,
      },
      attachments: attachments.map((attachment) => ({
        ...attachment,
        file_url: SojebStorage.url(attachment.file),
      })),
    };
  }

  private async sendNotification(
    senderId: string,
    receiverId: string,
    conversationId: string,
    messageText: string,
    attachments: any[],
  ) {
    if (attachments.length > 0) {
      await this.chatNotificationService.notifyFileAttachment({
        senderId,
        receiverId,
        conversationId,
        fileName: attachments[0].name,
        fileType: attachments[0].type,
      });
    } else {
      await this.chatNotificationService.notifyNewMessage({
        senderId,
        receiverId,
        conversationId,
        messageText,
        messageType: 'text',
      });
    }
  }
}
