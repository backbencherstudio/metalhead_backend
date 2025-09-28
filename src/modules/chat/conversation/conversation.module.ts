import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';
import { ChatNotificationService } from '../chat-notification.service';
import { NotificationModule } from '../../application/notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [ConversationController],
  providers: [ConversationService, ChatNotificationService],
  exports: [ChatNotificationService],
})
export class ConversationModule {}
