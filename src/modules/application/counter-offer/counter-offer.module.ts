import { Module } from '@nestjs/common';
import { CounterOfferService } from './counter-offer.service';
import { CounterOfferController } from './counter-offer.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CounterOfferController],
  providers: [CounterOfferService],
  exports: [CounterOfferService],
})
export class CounterOfferModule {}
