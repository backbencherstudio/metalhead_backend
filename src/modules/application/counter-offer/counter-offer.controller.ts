// src/modules/application/counter-offer/counter-offer.controller.ts
import { Controller, Post, Body, Get, Param, Patch, Delete, UseGuards, Req } from '@nestjs/common';
import { CounterOfferService } from './counter-offer.service';
import { CreateCounterOfferDto } from '../counter-offer/dtos/create-counter-offer.dto';
import { AcceptCounterOfferDto } from './dtos/accept-counter-offer.dto';
import { UserCounterOfferDto } from './dtos/user-counter-offer.dto';
import { HelperAcceptCounterOfferDto } from './dtos/helper-accept-counter-offer.dto';


@Controller('counter-offers')
export class CounterOfferController {
  constructor(private readonly counterOfferService: CounterOfferService) {}

  @Post()
  async create(@Body() dto: CreateCounterOfferDto) {
    return this.counterOfferService.createCounterOffer(dto);
  }

  @Get('job/:job_id')
  async getByJob(@Param('job_id') job_id: string) {
    return this.counterOfferService.getCounterOffersByJob(job_id);
  }

  @Get('helper/:helper_id')
  async getByHelper(@Param('helper_id') helper_id: string) {
    return this.counterOfferService.getCounterOffersByHelper(helper_id);
  }
 @Post('accept/:counter_offer_id')
  async acceptCounterOffer(
    @Param('counter_offer_id') counter_offer_id: string,
    @Body('user_id') user_id: string, // for testing; later replace with auth guard
  ) {
    return this.counterOfferService.acceptCounterOfferWithNotification(counter_offer_id, user_id);
  }

  @Post('decline/:counter_offer_id')
  async declineCounterOffer(
    @Param('counter_offer_id') counter_offer_id: string,
    @Body('user_id') user_id: string, // for testing; later replace with auth guard
  ) {
    return this.counterOfferService.declineCounterOffer(counter_offer_id, user_id);
  }

  @Post('user-counter/:counter_offer_id')
  async userCounterBack(
    @Param('counter_offer_id') counter_offer_id: string,
    @Body() dto: UserCounterOfferDto,
  ) {
    return this.counterOfferService.userCounterBack(counter_offer_id, dto);
  }

  @Post('helper-accept/:counter_offer_id')
  async helperAcceptCounterOffer(
    @Param('counter_offer_id') counter_offer_id: string,
    @Body() dto: HelperAcceptCounterOfferDto,
  ) {
    return this.counterOfferService.helperAcceptCounterOfferWithNotification(counter_offer_id, dto);
  }
}
