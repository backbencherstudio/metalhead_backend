// src/modules/application/counter-offer/dtos/accept-counter-offer.dto.ts
import { IsString } from 'class-validator';

export class AcceptCounterOfferDto {
  @IsString()
  counter_offer_id: string;
}
