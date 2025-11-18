import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import {Role} from '../../../common/guard/role/role.enum'
export class CreateUserDto {
 
  @IsNotEmpty()
  @ApiProperty()
  first_name: string;

  @IsOptional()
  @ApiProperty()
  last_name?: string;

  @IsNotEmpty()
  @ApiProperty()
  email: string;

  @IsNotEmpty()
  @ApiProperty()
  username: string;

  @IsNotEmpty()
  @MinLength(8, { message: 'Password should be minimum 8' })
  @ApiProperty()
  password: string;


  @IsNotEmpty()  
  @ApiProperty({ description: 'Phone number of the user' })
  phone: string;

  @IsOptional()
  @IsEnum(Role)
  @ApiProperty({
    type: String,
    example: 'user',
  })
  type?: Role = Role.USER;

  // Optional profile/location fields for initial signup
  @IsOptional()
  @ApiProperty({ required: false })
  address?: string;

  @IsOptional()
  @ApiProperty({ required: false })
  city?: string;

  @IsOptional()
  @ApiProperty({ required: false })
  state?: string;

  @IsOptional()
  @ApiProperty({ required: false, description: 'Latitude from device GPS' })
  latitude?: number;

  @IsOptional()
  @ApiProperty({ required: false, description: 'Longitude from device GPS' })
  longitude?: number;
}
