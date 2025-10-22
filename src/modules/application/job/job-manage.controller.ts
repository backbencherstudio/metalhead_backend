import { Controller, Get, UseGuards, Req, Logger, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JobManageService } from './job-manage.service';

@ApiBearerAuth()
@ApiTags('Job Management')
@UseGuards(JwtAuthGuard)
@Controller('job-manage')
export class JobManageController {
  constructor(private readonly jobManageService: JobManageService) {}
  @ApiOperation({ summary: 'Get all jobs for user or helper' })
  @ApiResponse({ status: 200, description: 'All jobs retrieved successfully' })
  @Get('history')
  async jobsHistory(@Req() req: any) {
      const userId = req.user.userId || req.user.id;
      const userType = req.user.type;
      return await this.jobManageService.jobsHistory(userId, userType);
  }

  @Get('due-jobs/:days')
  async dueJobsByDays(@Param('days') days:string,@Req() req:any){
    const userId=req.user.userId
    return await this.jobManageService.dueJobsByDays(userId,days);
  } 
  
}


