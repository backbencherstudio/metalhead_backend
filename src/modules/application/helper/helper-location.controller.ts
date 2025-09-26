import { Controller, Patch, Get, Body, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HelperLocationService } from './helper-location.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Request } from 'express';

@ApiBearerAuth()
@ApiTags('Helper Location')
@UseGuards(JwtAuthGuard)
@Controller('helper/location')
export class HelperLocationController {
  constructor(private readonly helperLocationService: HelperLocationService) {}

  @ApiOperation({ summary: 'Update helper location with auto-geocoding' })
  @Patch()
  async updateLocation(
    @Body() locationData: {
      city?: string;
      state?: string;
      address?: string;
      latitude?: number;
      longitude?: number;
    },
    @Req() req: Request,
  ) {
    try {
      const helperId = (req as any).user.userId || (req as any).user.id;
      
      if (!helperId) {
        return {
          success: false,
          message: 'Helper ID not found in request',
        };
      }

      const result = await this.helperLocationService.updateHelperLocation(helperId, locationData);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Get helper current location info' })
  @Get()
  async getLocation(@Req() req: Request) {
    try {
      const helperId = (req as any).user.userId || (req as any).user.id;
      
      if (!helperId) {
        return {
          success: false,
          message: 'Helper ID not found in request',
        };
      }

      const location = await this.helperLocationService.getHelperLocation(helperId);
      return {
        success: true,
        data: location,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
