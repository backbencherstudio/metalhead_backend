// src/modules/application/counter-offer/dtos/user-counter-offer.dto.ts
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class UserCounterOfferDto {
  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsNotEmpty()
  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  note?: string;

  // For testing; later replace with auth guard
  @IsNotEmpty()
  @IsString()
  user_id: string;
}


