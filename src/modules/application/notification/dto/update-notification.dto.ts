import { IsOptional, IsDateString, IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateNotificationDto {
  @ApiProperty({ description: 'Notification ID' })
  id: number;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'Sender ID', required: false })
  sender_id?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'Receiver ID', required: false })
  receiver_id?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'Entity ID', required: false })
  entity_id?: string;

  @IsOptional()
  @IsDateString()
  @ApiProperty({ description: 'Mark notification as read', required: false })
  read_at?: string;
}
