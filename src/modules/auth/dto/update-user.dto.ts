import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsPhoneNumber } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @ApiProperty({
    description: 'Country',
    example: 'Nigeria',
  })
  country?: string;
  
  @IsOptional()
  @ApiProperty({
    description: 'username',
    example: 'John doe',
  })
  username?: string;

  @IsOptional()
  @ApiProperty({
    description: 'State',
    example: 'Lagos',
  })
  state: string;

  @IsOptional()
  @ApiProperty({
    description: 'City',
    example: 'Lagos',
  })
  city: string;

  @IsOptional()
  @ApiProperty({
    description: 'Local government',
    example: 'Lagos',
  })
  local_government?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Zip code',
    example: '123456',
  })
  zip_code: string;

  @IsPhoneNumber()
  @IsOptional()
  @ApiProperty({
    description: 'Phone number',
    example: '+91 9876543210',
  })
  phone_number?: number;

  @IsOptional()
  @ApiProperty({
    description: 'Address',
    example: 'New York, USA',
  })
  address: string;

  @IsOptional()
  @ApiProperty({
    description: 'Gender',
    example: 'male',
  })
  gender?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Date of birth',
    example: '14/11/2001',
  })
  date_of_birth?: string;

  @IsOptional()
  @ApiProperty({
    description: 'bio',
    example: 'a professional mechanic',
  })
  bio?: string;

  @IsOptional()
  @ApiProperty({
    description: 'Address',
    example: 'Plumbing, Fixing leakages',
  })
  age?: number;

  @IsOptional()
  @ApiProperty({
    description: 'Address',
    example: 'Plumbing, Fixing leakages',
  })
  skills?: string;
}
