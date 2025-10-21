import { Module } from '@nestjs/common';
import { NotificationModule } from './notification/notification.module';
import { ContactModule } from './contact/contact.module';
import { FaqModule } from './faq/faq.module';
import { JobModule } from './job/job.module';
import { CounterOfferModule } from './counter-offer/counter-offer.module';
import { ReviewModule } from './review/review.module';
import { LocationModule } from './location/location.module';
import { FirebaseNotificationModule } from './firebase-notification/firebase-notification.module';
import { CategoryModule } from './category/category.module';


@Module({
  imports: [NotificationModule, ContactModule, FaqModule, JobModule, CounterOfferModule, ReviewModule, LocationModule, FirebaseNotificationModule, CategoryModule],
})
export class ApplicationModule {}
