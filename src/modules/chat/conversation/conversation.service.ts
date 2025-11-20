import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import appConfig from '../../../config/app.config';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import { DateHelper } from '../../../common/helper/date.helper';
import { ForbiddenException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { ChatNotificationService } from '../chat-notification.service';

@Injectable()
export class ConversationService {
  constructor(
    private prisma: PrismaService,
    private readonly chatNotificationService: ChatNotificationService,
  ) {}

  async createConversation(job_id: string) {
    try {
      const job = await this.prisma.job.findUnique({
        where: { id: job_id },
        select: {
          user_id: true,
          assigned_helper_id: true,
          job_status: true
        }
      });
      
      if (!job) {
        throw new NotFoundException('Job not found');
      }
  

      if (job.job_status !== 'confirmed') {
        throw new ForbiddenException('Chat is only available for confirmed/ongoing jobs');
      }

      if (!job.assigned_helper_id) {
        throw new ForbiddenException('No helper assigned to this job');
      }

      const existingConversation = await this.prisma.conversation.findFirst({
        where: {
          OR: [
            { creator_id: job.user_id, participant_id: job.assigned_helper_id },
            { creator_id: job.assigned_helper_id, participant_id: job.user_id }
          ]
        }
      });

      if (!existingConversation) {
        const newConversation = await this.prisma.conversation.create({
          data: {
            creator_id: job.user_id,
            participant_id: job.assigned_helper_id
          },
          select: {
            id: true,
            creator_id: true,
            participant_id: true,
            created_at: true,
            updated_at: true,
            creator:{
              select:{
                first_name:true,
                avatar:true,
                username:true
              }
            },
            participant:{
              select:{
                first_name:true,
                avatar:true,
                username:true
              }
            }
          }
        });
        return {
          success: true,
          data: newConversation,
          message: 'Conversation created successfully'
        }
       }
      else{
        return {
          success: true,
          data: existingConversation,
          message: 'Conversation already exists'
        };
      
    };

    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  }
  
  async deleteConversation(id: string, userId: string) {
    try {
      const deleted = await this.prisma.$transaction(async (tx) => {
        // Grab everything you might need for follow-up work (notifications, file cleanup, etc.)
        const conversation = await tx.conversation.findUnique({
          where: {
            id: id,
            AND: [
              {
                OR: [
                  { creator_id: userId },
                  { participant_id: userId }
                ]
              }
            ]
          },
          include: {
            messages: {
              include: {
                attachments: true,
              },
            },
          },
        });
  
        if (!conversation) {
          throw new NotFoundException('Conversation not found');
        }
        console.log(conversation);
        const isCreator = conversation.creator_id === userId;
        const isParticipant = conversation.participant_id === userId;

        if(isCreator){
          await tx.conversation.update({ where: { id }, data: { deleted_by_creator: new Date(), is_deleted_by_creator: true } });
          
        }
        if(isParticipant){
          await tx.conversation.update({ where: { id }, data: { deleted_by_participant: new Date(), is_deleted_by_participant: true } });
          await tx.message.updateMany({ where: { conversation_id: id }, data: { deleted_for_receiver: new Date() } });
        }
        //   where:{
        //     conversation_id: id,
        //     AND:[
        //       {
        //         OR:[
        //           {sender_id:userId},
        //           {receiver_id:userId}
        //         ]
        //       }
        //     ]
        //   }
        // })
        // const isSenderDeleted = messages.some(message => message.sender_id === userId && message.deleted_for_sender !== null);
        // const isReceiverDeleted = messages.some(message => message.receiver_id === userId && message.deleted_for_receiver !== null);

        // if(isSenderDeleted && isReceiverDeleted){
        //   await tx.conversation.delete({ where: { id } });
        // }
        
        // Cascades remove messages + attachments at the DB level
      //   await tx.conversation.delete({ where: { id } });
      // });      
    })
   
      return {
        success: true,
        message: 'Conversation deleted successfully',
        
      };
    } catch (error) {
      console.error('Error deleting conversation:', error);
      return {
        success: false,
        message: error.message || 'Failed to delete conversation',
      };
    }
  }

  async getConversationById(id: string, userId: string) {
    try {
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: id,
          AND:[
            {
              OR:[
                {creator_id:userId},
                {participant_id:userId}
              ]
            }
          ]
        },
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          created_at: true,
          updated_at: true,
          deleted_by_creator: true,
          deleted_by_participant: true,
          creator: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
              availability:true,
            },
          },
          participant: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
              availability:true,
            },
          },
        },
      });
      // console.log(conversation);
     if(conversation.creator_id === userId) {
      if(conversation.deleted_by_creator !== null){
        return {
          success: false,
          message: 'You have deleted this conversation',
        };
      }
     }
     if(conversation.participant_id === userId) {
      if(conversation.deleted_by_participant !== null){
        return {
          success: false,
          message: 'You have deleted this conversation',
        };
      }
     }
      
      if (!conversation) {
        return {
          success: false,
          message: 'Incorrect conversation id',
        };
      }

      return {
        success: true,
        message: 'Conversation fetched successfully',
        data: conversation,
      };
    } catch (error) {
      console.log('Error fetching conversation:', error);
      return {
        success: false,
        message: error.message || 'Failed to fetch conversation',
      };
    }
  }

  async findConversationByUser(userId){

    if(!userId){
      throw new UnauthorizedException("You are not authorized")
    }

    const conversations=await this.prisma.conversation.findMany({
      where:{
        OR:[
          {creator_id:userId},
          {participant_id:userId}
        ]
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
      

      
    })

    conversations.forEach(conversation=>{
      conversation.messages.forEach(message=>{
        message.attachments.forEach(attachment=>{
          attachment["file_url"] = SojebStorage.url(appConfig().storageUrl.attachment+'/'+attachment.file);
        });
      });
    });

    if(!conversations){
      throw new NotFoundException("conversations are not created yet")
    }

    

    return{
      success:true,
      conversations
    }
  }

}
