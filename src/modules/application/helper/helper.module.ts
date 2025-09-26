import { Module } from '@nestjs/common';
import { HelperLocationService } from './helper-location.service';
import { HelperLocationController } from './helper-location.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { GeocodingService } from '../../../common/lib/Geocoding/geocoding.service';

@Module({
  imports: [PrismaModule],
  controllers: [HelperLocationController],
  providers: [HelperLocationService, GeocodingService],
  exports: [HelperLocationService],
})
export class HelperModule {}
