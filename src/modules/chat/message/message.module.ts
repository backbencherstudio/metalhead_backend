import { Global, Module } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { MessageGateway } from './message.gateway';
import { ChatNotificationService } from '../chat-notification.service';
import { NotificationModule } from '../../application/notification/notification.module';
import { FirebaseNotificationModule } from '../../application/firebase-notification/firebase-notification.module';

@Global()
@Module({
  imports: [NotificationModule, FirebaseNotificationModule],
  controllers: [MessageController],
  providers: [MessageService, MessageGateway, ChatNotificationService],
  exports: [MessageGateway, ChatNotificationService],
})
export class MessageModule {}
