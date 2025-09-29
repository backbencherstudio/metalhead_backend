import { Module } from '@nestjs/common';
import { ConversationModule } from './conversation/conversation.module';
import { MessageModule } from './message/message.module';
import { UserModule } from './user/user.module';
import { ChatNotificationService } from './chat-notification.service';
import { NotificationModule } from '../application/notification/notification.module';
import { FirebaseNotificationModule } from '../application/firebase-notification/firebase-notification.module';

@Module({
  imports: [ConversationModule, MessageModule, UserModule, NotificationModule, FirebaseNotificationModule],
  providers: [ChatNotificationService],
  exports: [ChatNotificationService],
})
export class ChatModule {}
