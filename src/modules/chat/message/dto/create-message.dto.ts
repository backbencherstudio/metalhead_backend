import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AttachmentDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: 'File name' })
  name: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: 'MIME type (image/jpeg, audio/mpeg, etc.)' })
  type: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: 'File content as base64 string' })
  content: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'File size in bytes', required: false })
  size?: number;
}

export class CreateMessageDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: 'Receiver user ID' })
  receiver_id: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: 'Conversation ID' })
  conversation_id: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'Text message content', required: false })
  message?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  @ApiProperty({ 
    description: 'Array of attachments (images/audios)', 
    required: false,
    type: [AttachmentDto]
  })
  attachments?: AttachmentDto[];
}