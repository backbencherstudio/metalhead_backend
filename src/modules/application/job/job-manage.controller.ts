import { Controller, Get, UseGuards, Req, Logger, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JobManageService } from './job-manage.service';

@ApiBearerAuth()
@ApiTags('Job Management')
@UseGuards(JwtAuthGuard)
@Controller('job-manage')
export class JobManageController {
  constructor(private readonly jobManageService: JobManageService) {}
  @Get('history')
  async jobsHistory(@Req() req: any) {
      const userId = req.user.userId || req.user.id;
      const userType = req.user.type;
      return await this.jobManageService.jobsHistory(userId, userType);
  }

  @ApiOperation({ summary: 'Get count of due jobs within specified days' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days to look ahead (default: 1)' })
  @ApiResponse({ status: 200, description: 'Due jobs count retrieved successfully' })
  @Get('due-jobs')
  async dueJobsByDays(
    @Query('days', new DefaultValuePipe(1), ParseIntPipe) days: number,
    @Req() req: any
  ) {
    const userId = req.user.userId || req.user.id;
    return await this.jobManageService.dueJobsByDays(userId, days.toString());
  } 
  
  @Get('current-all-jobs')
  async currentallJobs(@Req() req:any){
    const userId=req.user.userId
    const userType=req.user.type;
    return this.jobManageService.currentRunningJobs(userId,userType);
  }
}


