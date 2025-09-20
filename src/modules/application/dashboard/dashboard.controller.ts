import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { 
  HelperDashboardDto, 
  UserDashboardDto, 
  JobActionStateDto 
} from './dto/dashboard-response.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @ApiOperation({ summary: 'Get helper dashboard data' })
  @ApiResponse({ 
    status: 200, 
    description: 'Helper dashboard data retrieved successfully',
    type: HelperDashboardDto 
  })
  @Get('helper')
  async getHelperDashboard(@Req() req: any): Promise<HelperDashboardDto> {
    const userId = req.user.userId;
    return this.dashboardService.getHelperDashboard(userId);
  }

  @ApiOperation({ summary: 'Get user dashboard data' })
  @ApiResponse({ 
    status: 200, 
    description: 'User dashboard data retrieved successfully',
    type: UserDashboardDto 
  })
  @Get('user')
  async getUserDashboard(@Req() req: any): Promise<UserDashboardDto> {
    const userId = req.user.userId;
    return this.dashboardService.getUserDashboard(userId);
  }

  @ApiOperation({ summary: 'Get job action states for a specific job' })
  @ApiResponse({ 
    status: 200, 
    description: 'Job action states retrieved successfully',
    type: JobActionStateDto 
  })
  @Get('job/:jobId/actions')
  async getJobActionState(
    @Param('jobId') jobId: string,
    @Req() req: any
  ): Promise<JobActionStateDto> {
    const userId = req.user.userId;
    return this.dashboardService.getJobActionState(jobId, userId);
  }

  @ApiOperation({ summary: 'Get helper dashboard data by helper ID (admin only)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Helper dashboard data retrieved successfully',
    type: HelperDashboardDto 
  })
  @Get('helper/:helperId')
  async getHelperDashboardById(@Param('helperId') helperId: string): Promise<HelperDashboardDto> {
    return this.dashboardService.getHelperDashboard(helperId);
  }

  @ApiOperation({ summary: 'Get user dashboard data by user ID (admin only)' })
  @ApiResponse({ 
    status: 200, 
    description: 'User dashboard data retrieved successfully',
    type: UserDashboardDto 
  })
  @Get('user/:userId')
  async getUserDashboardById(@Param('userId') userId: string): Promise<UserDashboardDto> {
    return this.dashboardService.getUserDashboard(userId);
  }
}
