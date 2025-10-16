import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { Role } from '../../../common/guard/role/role.enum';

export class ConvertRoleDto {
  @IsNotEmpty()
  @IsEnum(Role, { message: 'Role must be either user or helper' })
  @ApiProperty({
    description: 'The new role to convert to',
    enum: [Role.USER, Role.HELPER],
    example: 'helper'
  })
  newRole: Role.USER | Role.HELPER;
}
