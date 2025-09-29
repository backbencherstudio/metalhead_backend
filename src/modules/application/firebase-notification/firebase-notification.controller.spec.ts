import { Test, TestingModule } from '@nestjs/testing';
import { FirebaseNotificationController } from './firebase-notification.controller';
import { FirebaseNotificationService } from './firebase-notification.service';

describe('FirebaseNotificationController', () => {
  let controller: FirebaseNotificationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FirebaseNotificationController],
      providers: [FirebaseNotificationService],
    }).compile();

    controller = module.get<FirebaseNotificationController>(FirebaseNotificationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
