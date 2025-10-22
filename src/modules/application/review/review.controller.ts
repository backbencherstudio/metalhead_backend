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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReviewService } from './review.service';
import { CreateReviewDto, ReviewResponseDto, JobReviewsResponseDto, UserReviewsSummaryDto, UpdateReviewDto, UserStatsResponseDto } from './dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';

@ApiTags('Reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new review' })
  @ApiResponse({
    status: 201,
    description: 'Review created successfully',
    type: ReviewResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async create(
    @Body() createReviewDto: CreateReviewDto,
    @GetUser('userId') userId: string,
  ): Promise<ReviewResponseDto> {
    return this.reviewService.createReview(createReviewDto, userId);
  }

  @Get("avrg-review")
  async averageReview(@Param('userId') userId:string,@Req() userType:string){
    userType=userType.toLowerCase();
    return this.reviewService.averageReview(userId,userType);
  }
  

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get reviews for a specific user' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiResponse({
    status: 200,
    description: 'User reviews retrieved successfully',
    type: UserReviewsSummaryDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserReviews(
    @Param('userId') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<UserReviewsSummaryDto> {
    return this.reviewService.getUserReviews(userId, page, limit);
  }

  @Get('my-reviews')
  @ApiOperation({ summary: 'Get current user reviews' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiResponse({
    status: 200,
    description: 'User reviews retrieved successfully',
    type: [ReviewResponseDto],
  })
  async getMyReviews(
    @GetUser('userId') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<ReviewResponseDto[]> {
    return this.reviewService.getMyReviews(userId, page, limit);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a review' })
  @ApiResponse({
    status: 200,
    description: 'Review updated successfully',
    type: ReviewResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async update(
    @Param('id') id: string,
    @Body() updateReviewDto: UpdateReviewDto,
    @GetUser('userId') userId: string,
  ): Promise<ReviewResponseDto> {
    return this.reviewService.updateReview(id, updateReviewDto, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a review' })
  @ApiResponse({ status: 200, description: 'Review deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async remove(
    @Param('id') id: string,
    @GetUser('userId') userId: string,
  ): Promise<{ message: string }> {
    await this.reviewService.deleteReview(id, userId);
    return { message: 'Review deleted successfully' };
  }

  @Get('user/:userId/stats')
  @ApiOperation({ summary: 'Get comprehensive user statistics including jobs and ratings' })
  @ApiResponse({
    status: 200,
    description: 'User statistics retrieved successfully',
    type: UserStatsResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserStats(@Param('userId') userId: string): Promise<UserStatsResponseDto> {
    return this.reviewService.getUserStats(userId);
  }

  @Get('my-stats')
  @ApiOperation({ summary: 'Get current user statistics including jobs and ratings' })
  @ApiResponse({
    status: 200,
    description: 'User statistics retrieved successfully',
    type: UserStatsResponseDto,
  })
  async getMyStats(@GetUser('userId') userId: string): Promise<UserStatsResponseDto> {
    return this.reviewService.getUserStats(userId);
  }

}

