import { Module } from '@nestjs/common';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { JobNotificationService } from './job-notification.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { LocationService } from '../../../common/lib/Location/location.service';
import { GeocodingService } from '../../../common/lib/Geocoding/geocoding.service';

@Module({
  imports: [PrismaModule],
  controllers: [JobController],
  providers: [JobService, JobNotificationService, LocationService, GeocodingService],
  exports: [JobService, JobNotificationService],
})
export class JobModule {}
