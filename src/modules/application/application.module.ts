import { Module } from '@nestjs/common';
import { NotificationModule } from './notification/notification.module';
import { ContactModule } from './contact/contact.module';
import { FaqModule } from './faq/faq.module';
import { JobModule } from './job/job.module';
import { CounterOfferModule } from './counter-offer/counter-offer.module';
import { ReviewModule } from './review/review.module';
import { LocationModule } from './location/location.module';


@Module({
  imports: [NotificationModule, ContactModule, FaqModule, JobModule, CounterOfferModule, ReviewModule, LocationModule],
})
export class ApplicationModule {}
