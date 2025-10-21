import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { Role } from '../../../common/guard/role/role.enum'
import { Match } from 'src/modules/common/decorators/match.decorator';
export class CreateUserDto {

  @IsNotEmpty()
  @ApiProperty()
  first_name: string;

  @IsOptional()
  @ApiProperty()
  last_name: string;

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
  @Match('password', { message: 'Passwords do not match' })
  @ApiProperty()
  confirm_password: string;

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
}
