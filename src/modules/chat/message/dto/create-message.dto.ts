import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateMessageDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  receiver_id: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  conversation_id: string;

  @IsOptional()
  @IsString()
  @ApiProperty()
  message?: string;
}

export class CreateAttachmentMessageDto extends CreateMessageDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: 'Original filename of attachment' })
  name: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'MIME type' })
  type?: string;
}