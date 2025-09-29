import { IsString, IsNumber, IsOptional, IsIn } from 'class-validator';

export class TestJobNotificationDto {
  @IsString()
  receiverId: string;

  @IsString()
  jobId: string;

  @IsString()
  jobTitle: string;

  @IsNumber()
  jobPrice: number;

  @IsString()
  jobLocation: string;

  @IsString()
  senderId: string;

  @IsOptional()
  @IsIn(['new_job', 'job_accepted', 'job_completed', 'job_cancelled'])
  notificationType?: 'new_job' | 'job_accepted' | 'job_completed' | 'job_cancelled';
}

export class TestMessageNotificationDto {
  @IsString()
  receiverId: string;

  @IsString()
  senderId: string;

  @IsString()
  conversationId: string;

  @IsOptional()
  @IsString()
  messageText?: string;

  @IsOptional()
  @IsIn(['text', 'image', 'audio', 'file'])
  messageType?: 'text' | 'image' | 'audio' | 'file';
}

export class TestGenericNotificationDto {
  @IsString()
  receiverId: string;

  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  data?: any;
}
