// src/modules/application/counter-offer/dtos/helper-accept-counter-offer.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class HelperAcceptCounterOfferDto {
  @IsNotEmpty()
  @IsString()
  helper_id: string; // for testing; later replace with auth guard
}

