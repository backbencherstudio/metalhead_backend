import { Test, TestingModule } from '@nestjs/testing';
import { CounterOfferService } from './counter-offer.service';

describe('CounterOfferService', () => {
  let service: CounterOfferService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CounterOfferService],
    }).compile();

    service = module.get<CounterOfferService>(CounterOfferService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
