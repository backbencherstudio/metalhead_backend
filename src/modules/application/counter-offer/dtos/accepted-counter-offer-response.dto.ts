// src/modules/application/counter-offer/dtos/accepted-counter-offer-response.dto.ts
export class AcceptedCounterOfferResponseDto {
  job_id: string;
  job_title: string;
  original_price: number;
  counter_offer_amount: number;
  counter_offer_type: string;
  counter_offer_note?: string;
  helper_id: string;
  helper_name: string;
  helper_email: string;
  status: string; // "accepted" - indicates the offer was accepted
}


