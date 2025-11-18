// src/modules/application/counter-offer/counter-offer.controller.ts
import { Controller, Post, Body, Get, Param, Patch, Delete, UseGuards, Req, Query, Logger } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CounterOfferService } from './counter-offer.service';
import { CreateCounterOfferDto } from '../counter-offer/dtos/create-counter-offer.dto';
import { AcceptCounterOfferDto } from './dtos/accept-counter-offer.dto';
// import { UserCounterOfferDto } from './dtos/user-counter-offer.dto';
// import { HelperAcceptCounterOfferDto } from './dtos/helper-accept-counter-offer.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Request } from 'express';

@ApiBearerAuth()
@ApiTags('Counter Offers')
@UseGuards(JwtAuthGuard)
@Controller('counter-offers')
export class CounterOfferController {
  constructor(private readonly counterOfferService: CounterOfferService) {}

@Post()
async createCounterOffer(@Body() createCounterOfferDto: CreateCounterOfferDto, @Req() req:any, ) {
    // Only helpers can create counter offers
    if (!req?.user || req.user.type !== 'helper') {
      throw new (await import('@nestjs/common')).ForbiddenException('Only helpers can create counter offers');
    }
    const userId=req.user.id;
    return this.counterOfferService.createCounterOffer(createCounterOfferDto, userId);
}

@Post('accept')
async acceptCounterOffer(
@Body() acceptCounterOfferDto: AcceptCounterOfferDto, @Req() req:any){
  const userId=req.user.userId;
  return this.counterOfferService.acceptCounterOffer(acceptCounterOfferDto, userId);
}

@Post('direct-accept/:jobId')
@ApiOperation({ summary: 'Helper directly accepts a job without counter offer' })
async directAcceptJob(
@Param('jobId') jobId: string, 
@Req() req:any){
  // Only helpers can directly accept jobs
  if (!req?.user || req.user.type !== 'helper') {
    throw new (await import('@nestjs/common')).ForbiddenException('Only helpers can accept jobs');
  }
  const userId = req.user.id;
  return this.counterOfferService.helperAcceptsJob(userId, jobId);
}
@Post('decline/:counterOfferId')
@ApiOperation({ summary: 'Helper directly accepts a job without counter offer' })
async declineCounterOffer(
@Param('jobId') jobId: string, 
@Req() req:any){
  const counterOfferId=req.params.counterOfferId;
  const userId = req.user.id;
  return this.counterOfferService.declineCounterOffer(userId, counterOfferId);
}

@Get('all-counter-offers')
async getMyCounterOffers( 
  @Req() req: any,
  @Query('page') page = '1',
  @Query('limit') limit = '10',
) {
  const userId = req.user.id;      
  const userType = req.user.type as 'user' | 'helper';
  return this.counterOfferService.getMyCounterOffers(
    userId,
    userType,
    Number(page),
    Number(limit),
  );
}

@Get('accepted-offer/:jobId')
async getAcceptedOffer(
  @Param('jobId') jobId: string,
  @Req() req: any,
) {
  const userId = req.user.id;
  return this.counterOfferService.getAcceptedOfferByJobId(userId, jobId);
}

// @Get(':jobId')
// async getCounterOffers(@Param('jobId') jobId: string, @Req() req:any){
//   const userId = req.user.id;
//   return this.counterOfferService.getCounterOffers(userId, jobId);
// }

@Get('recent-offer')
async getRecentOffer(
  @Req() req: any,
) {
  const userId = req.user.id;
  return this.counterOfferService.getRecentOffer(userId);
}

@Get('get-offers/:jobId')
async getOffer(
  @Param('jobId') jobId: string,
  @Req() req: any,
) {
  const userId = req.user.id;
  return this.counterOfferService.getOffer(userId, jobId);
}

}