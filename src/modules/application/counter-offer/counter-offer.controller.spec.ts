import { Test, TestingModule } from '@nestjs/testing';
import { CounterOfferController } from './counter-offer.controller';

describe('CounterOfferController', () => {
  let controller: CounterOfferController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CounterOfferController],
    }).compile();

    controller = module.get<CounterOfferController>(CounterOfferController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
