import { ApiProperty, PartialType, OmitType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsPhoneNumber, ValidateIf, IsArray, IsString, IsNumber } from 'class-validator';
import { Transform, Type } from 'class-transformer';

// Email is intentionally excluded from updates for security reasons
export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['email'] as const)) {
  // Explicitly reject email updates
  @ValidateIf(() => false) // This will always fail validation if email is provided
  @ApiProperty({
    description: 'Email is not updateable through this endpoint',
    example: 'This field will be ignored',
    required: false,
  })
  email?: string;
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

 
  @IsOptional()
  @ApiProperty({
    description: 'Phone number',
    example: '+91 9876543210',
  })
  phone_number?: string;

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
  @Type(() => Number)
  @IsNumber()
  @Transform(({ value }) => {
    if (value === null || value === undefined) return value;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? value : num;
  })
  @ApiProperty({
    description: 'Age',
    example: 25,
    type: Number,
  })
  age?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // If not valid JSON, try splitting by comma
        return value.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    return [value];
  })
  @ApiProperty({
    description: 'Array of skills',
    example: ['Plumbing', 'Fixing leakages', 'Electrical work', 'Carpentry'],
    type: [String],
  })
  skills?: string[];
}
