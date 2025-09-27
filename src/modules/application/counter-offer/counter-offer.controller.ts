// src/modules/application/counter-offer/counter-offer.controller.ts
import { Controller, Post, Body, Get, Param, Patch, Delete, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CounterOfferService } from './counter-offer.service';
import { CreateCounterOfferDto } from '../counter-offer/dtos/create-counter-offer.dto';
import { AcceptCounterOfferDto } from './dtos/accept-counter-offer.dto';
import { UserCounterOfferDto } from './dtos/user-counter-offer.dto';
import { HelperAcceptCounterOfferDto } from './dtos/helper-accept-counter-offer.dto';
import { DirectAcceptJobDto } from './dtos/direct-accept-job.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Request } from 'express';

@ApiBearerAuth()
@ApiTags('Counter Offers')
@UseGuards(JwtAuthGuard)
@Controller('counter-offers')
export class CounterOfferController {
  constructor(private readonly counterOfferService: CounterOfferService) {}

  @ApiOperation({ summary: 'Create a new counter offer (Helper only)' })
  @Post()
  async create(@Body() dto: CreateCounterOfferDto, @Req() req: Request) {
    const helperId = (req as any).user.userId || (req as any).user.id;
    const userType = (req as any).user.type;
    
    if (userType !== 'helper') {
      throw new Error('Only helpers can create counter offers. Please switch to helper role first.');
    }
    
    return this.counterOfferService.createCounterOffer(dto, helperId);
  }

  @ApiOperation({ summary: 'Get counter offers for a specific job' })
  @Get('job/:job_id')
  async getByJob(@Param('job_id') job_id: string) {
    return this.counterOfferService.getCounterOffersByJob(job_id);
  }

  @ApiOperation({ summary: 'Get counter offers by a specific helper' })
  @Get('helper/:helper_id')
  async getByHelper(@Param('helper_id') helper_id: string) {
    return this.counterOfferService.getCounterOffersByHelper(helper_id);
  }
  @ApiOperation({ summary: 'Accept a counter offer (Job Owner only)' })
  @Post('accept/:counter_offer_id')
  async acceptCounterOffer(
    @Param('counter_offer_id') counter_offer_id: string,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.userId || (req as any).user.id;
    return this.counterOfferService.acceptCounterOfferWithNotification(counter_offer_id, userId);
  }

  @ApiOperation({ summary: 'Decline a counter offer (Job Owner only)' })
  @Post('decline/:counter_offer_id')
  async declineCounterOffer(
    @Param('counter_offer_id') counter_offer_id: string,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.userId || (req as any).user.id;
    return this.counterOfferService.declineCounterOffer(counter_offer_id, userId);
  }

  @ApiOperation({ summary: 'User counter back to helper offer (Job Owner only)' })
  @Post('user-counter/:counter_offer_id')
  async userCounterBack(
    @Param('counter_offer_id') counter_offer_id: string,
    @Body() dto: UserCounterOfferDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.userId || (req as any).user.id;
    return this.counterOfferService.userCounterBack(counter_offer_id, dto, userId);
  }

  @ApiOperation({ summary: 'Helper accept user counter offer (Helper only)' })
  @Post('helper-accept/:counter_offer_id')
  async helperAcceptCounterOffer(
    @Param('counter_offer_id') counter_offer_id: string,
    @Body() dto: HelperAcceptCounterOfferDto,
    @Req() req: Request,
  ) {
    const helperId = (req as any).user.userId || (req as any).user.id;
    const userType = (req as any).user.type;
    
    if (userType !== 'helper') {
      throw new Error('Only helpers can accept counter offers. Please switch to helper role first.');
    }
    
    return this.counterOfferService.helperAcceptCounterOfferWithNotification(counter_offer_id, helperId);
  }

  @ApiOperation({ summary: 'Helper directly accept a job (Helper only)' })
  @Post('direct-accept/:job_id')
  async directAcceptJob(
    @Param('job_id') job_id: string,
    @Body() dto: DirectAcceptJobDto,
    @Req() req: Request,
  ) {
    const helper_id = (req as any).user.userId || (req as any).user.id;
    const userType = (req as any).user.type;
    
    if (userType !== 'helper') {
      throw new Error('Only helpers can accept jobs. Please switch to helper role first.');
    }
    
    return this.counterOfferService.directAcceptJob(job_id, { ...dto, helper_id });
  }
}
