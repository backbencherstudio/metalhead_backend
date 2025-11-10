import {Controller,Get,Post,Body,Param,UseGuards,Query,ParseIntPipe,DefaultValuePipe,Req,} from '@nestjs/common';
import {ApiTags,ApiBearerAuth,
} from '@nestjs/swagger';
import { ReviewService } from './review.service';
import {CreateReviewDto,ReviewResponseDto,UserReviewsSummaryDto} from './dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';

@ApiTags('Reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  async create(
    @Body() createReviewDto: CreateReviewDto,
    @GetUser('userId') userId: string,
  ): Promise<ReviewResponseDto> {
    return this.reviewService.createReview(createReviewDto, userId);
  }

  @Get('user/:userId')
  async getUserReviews(
    @Param('userId') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<UserReviewsSummaryDto> {
    return this.reviewService.getUserReviews(userId, page, limit);
  }

  @Get('job-review/:jobId')
  async getReviewOfJob(
    @Param('jobId') jobId: string,
    @Req() req: any,
  ): Promise<any> {
    const userId = req.user.userId || req.user.id;
    return this.reviewService.getReviewOfJob(jobId, userId);
  }

  @Get('my-stats')
  async myState(@Req() req:any){
    const userId=req.user.userId
    return this.reviewService.myReview(userId)
  }

  @Get('my-earning-stats')
  async myEarningStats(
    @Req() req: any,
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number
  ) {
    const userId = req.user.userId || req.user.id;
    // Clamp days between 1 and 365
    const daysInt = Math.max(1, Math.min(days, 365));
    return this.reviewService.myEarningStats(userId, daysInt);
  }


}

