import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { CreateConversationDto, CreateConversationFromJobDto } from './dto/create-conversation.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';


@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversation')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}


  @Post('create')
  @ApiOperation({ summary: 'Create a conversation from a job' })
  async createConversation(@Body() dto: CreateConversationFromJobDto){
    return this.conversationService.createConversation(dto.job_id)
  }

  @Delete('delete/:id')
  @ApiOperation({ summary: 'Delete a conversation by ID' })
  async deleteConversation(@Param('id') id:string ){
   return this.conversationService.deleteConversation(id)
  }
  
  @Get('find/:id')
  @ApiOperation({ summary: 'Get a conversation by ID' })
  async getConversationById(@Param('id') id:string){
   return this.conversationService.getConversationById(id)
  }

  @Get('all')
  async findConversationByUser(@Req() req:Request){
    const userId= (req as any).user.userId
    return await this.conversationService.findConversationByUser(userId)
  }

}
