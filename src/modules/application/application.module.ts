import { Module } from '@nestjs/common';
import { NotificationModule } from './notification/notification.module';
import { ContactModule } from './contact/contact.module';
import { FaqModule } from './faq/faq.module';
import { JobModule } from './job/job.module';

@Module({
  imports: [NotificationModule, ContactModule, FaqModule, JobModule],
})
export class ApplicationModule {}
