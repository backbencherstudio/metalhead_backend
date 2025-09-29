import { PartialType } from '@nestjs/swagger';
import { CreateFirebaseNotificationDto } from './create-firebase-notification.dto';

export class UpdateFirebaseNotificationDto extends PartialType(CreateFirebaseNotificationDto) {}
