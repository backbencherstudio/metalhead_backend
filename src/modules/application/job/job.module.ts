import { Module } from '@nestjs/common';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { JobNotificationService } from './job-notification.service';
import { JobHistoryService } from './job-history.service';
import { JobHistoryController } from './job-history.controller';
import { NearbyJobsController } from './nearby-jobs.controller';
import { NearbyJobsService } from './nearby-jobs.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { LocationService } from '../../../common/lib/Location/location.service';
import { GeocodingService } from '../../../common/lib/Geocoding/geocoding.service';
import { FirebaseNotificationModule } from '../firebase-notification/firebase-notification.module';

@Module({
  imports: [PrismaModule, FirebaseNotificationModule],
  controllers: [
    JobController, 
    JobHistoryController,
    NearbyJobsController
  ],
  providers: [
    JobService, 
    JobNotificationService, 
    JobHistoryService,
    NearbyJobsService,
    LocationService, 
    GeocodingService
  ],
  exports: [
    JobService, 
    JobNotificationService,
    JobHistoryService,
    NearbyJobsService
  ],
})
export class JobModule {}
