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
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Role } from '../../../common/guard/role/role.enum';
import { Roles } from '../../../common/guard/role/roles.decorator';

@ApiBearerAuth()
@ApiTags('conversation')
@UseGuards(JwtAuthGuard)
@Controller('/conversation')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  // @ApiOperation({ summary: 'Create conversation' })
  // @Post()
  // async create(@Body() jobId: string, @Req() req:Request) {
  //     const userId=(req as any).user.userId;
  //     return await this.conversationService.create(jobId, userId);
  //   }
  // }

  // @ApiOperation({ summary: 'Create or get conversation for a confirmed job' })
  @Post('from-job')
  async createFromJob(@Body() dto: CreateConversationFromJobDto) {
   return await this.conversationService.createFromJob(dto.job_id);
  }

  
  // @ApiOperation({ summary: 'Get all conversations' })
  // @Get()
  // async findAll() {
  //   try {
  //     const conversations = await this.conversationService.findAll();
  //     return conversations;
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: error.message,
  //     };
  //   }
  // }

  // @ApiOperation({ summary: 'Get a conversation by id' })
  // @Get(':id')
  // async findOne(@Param('id') id: string) {
  //   try {
  //     const conversation = await this.conversationService.findOne(id);
  //     return conversation;
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: error.message,
  //     };
  //   }
  // }

  // @Roles(Role.ADMIN)
  // @ApiOperation({ summary: 'Delete a conversation' })
  // @Delete(':id')
  // async remove(@Param('id') id: string) {
  //   try {
  //     const conversation = await this.conversationService.remove(id);
  //     return conversation;
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: error.message,
  //     };
  //   }
  // }

}
