// src/modules/application/counter-offer/dto/create-counter-offer.dto.ts
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCounterOfferDto {
  @IsNotEmpty()
  @IsString()
  job_id: string;

  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsNotEmpty()
  @IsString()
  type: string; // e.g. "fixed" or "hourly"

  @IsOptional()
  @IsString()
  note?: string;

  @IsNotEmpty()
  @IsString()
  helper_id: string; // for now send it from Postman
}
