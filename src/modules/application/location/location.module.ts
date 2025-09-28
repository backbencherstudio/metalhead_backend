import { Module } from '@nestjs/common';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';
import { GeocodingService } from '../../../common/lib/Geocoding/geocoding.service';

@Module({
  controllers: [LocationController],
  providers: [LocationService, GeocodingService],
  exports: [LocationService],
})
export class LocationModule {}
