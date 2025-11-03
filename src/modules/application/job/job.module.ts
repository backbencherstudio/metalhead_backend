import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { JobNotificationService } from './job-notification.service';
import { JobManageService } from './job-manage.service';
import { JobManageController } from './job-manage.controller';
import { NearbyJobsController } from './nearby-jobs.controller';
import { NearbyJobsService } from './nearby-jobs.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { LocationService } from '../../../common/lib/Location/location.service';
import { GeocodingService } from '../../../common/lib/Geocoding/geocoding.service';
import { FirebaseNotificationModule } from '../firebase-notification/firebase-notification.module';
import { CategoryModule } from '../category/category.module';
import { PaymentModule } from '../../payment/payment.module';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, FirebaseNotificationModule, CategoryModule, PaymentModule],
  controllers: [
    JobManageController,
    JobController, 
    
    NearbyJobsController
  ],
  providers: [
    JobService, 
    JobNotificationService, 
    JobManageService,
    NearbyJobsService,
    LocationService, 
    GeocodingService
  ],
  exports: [
    JobManageService,
    JobService, 
    JobNotificationService,
    NearbyJobsService
  ],
})
export class JobModule {}
