import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ReviewService } from './review.service';
import {
  CreateReviewDto,
  ReviewResponseDto,
  JobReviewsResponseDto,
  UserReviewsSummaryDto,
  UpdateReviewDto,
  UserStatsResponseDto,
} from './dto';
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
  async getReviewOfJob(@Param('jobId') jobId: string): Promise<any> {
    return this.reviewService.getReviewOfJob(jobId);
  }

  @Get()
  async myState(@Req() req:any){
    const userId=req.user.userId
    return this.reviewService.myReview(userId)
  }

}
