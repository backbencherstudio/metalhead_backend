import { ApiProperty } from '@nestjs/swagger';

export class JobRequirementResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}

export class JobNoteResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}

export class JobPhotoResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  size: number;

  @ApiProperty()
  file: string;

  @ApiProperty()
  file_alt: string;

  @ApiProperty()
  url: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}

export class JobResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  category: string;

  @ApiProperty()
  start_time: Date;

  @ApiProperty()
  end_time: Date;

  @ApiProperty()
  price: number;

  @ApiProperty()
  payment_type: string;

  @ApiProperty()
  job_type: string;

  @ApiProperty()
  location: string;

  @ApiProperty({ required: false })
  latitude?: number;

  @ApiProperty({ required: false })
  longitude?: number;

  @ApiProperty()
  estimated_time: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ type: [JobRequirementResponseDto] })
  requirements: JobRequirementResponseDto[];

  @ApiProperty({ type: [JobNoteResponseDto] })
  notes: JobNoteResponseDto[];

  @ApiProperty({ required: false })
  urgent_note?: string;
  @ApiProperty({ type: [String] })
  photos: string[];

  @ApiProperty()
  user_id: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;

  @ApiProperty({ required: false })
  job_status?: string; // posted, counter_offer, confirmed, ongoing, completed, paid

  // Additional fields for accepted offer and status
  @ApiProperty({ required: false })
  current_status?: string; // e.g., 'confirmed' when a counter offer is accepted, else 'counter_offer'


}
