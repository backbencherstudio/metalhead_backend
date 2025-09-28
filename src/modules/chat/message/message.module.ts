import { Global, Module } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { MessageGateway } from './message.gateway';
import { ChatNotificationService } from '../chat-notification.service';
import { NotificationModule } from '../../application/notification/notification.module';

@Global()
@Module({
  imports: [NotificationModule],
  controllers: [MessageController],
  providers: [MessageService, MessageGateway, ChatNotificationService],
  exports: [MessageGateway, ChatNotificationService],
})
export class MessageModule {}
