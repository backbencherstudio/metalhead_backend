// src/modules/application/counter-offer/counter-offer.controller.ts
import { Controller, Post, Body, Get, Param, Patch, Delete, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CounterOfferService } from './counter-offer.service';
import { CreateCounterOfferDto } from '../counter-offer/dtos/create-counter-offer.dto';
import { AcceptCounterOfferDto } from './dtos/accept-counter-offer.dto';
import { UserCounterOfferDto } from './dtos/user-counter-offer.dto';
import { HelperAcceptCounterOfferDto } from './dtos/helper-accept-counter-offer.dto';
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

@Get(':jobId')
async getCounterOffers(@Param('jobId') jobId: string, @Req() req:any){
  const userId = req.user.id;
  return this.counterOfferService.getCounterOffers(userId, jobId);
}

}