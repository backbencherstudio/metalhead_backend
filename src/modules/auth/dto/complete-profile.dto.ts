import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber, IsDateString, IsArray, ArrayNotEmpty, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class CompleteProfileDto {

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    address: string;

    @IsNotEmpty()
    @IsString()
    city: string;

    @IsNotEmpty()
    @IsString()
    state: string;

    @IsNotEmpty()
    @IsString()
    zip: string;

    @IsOptional()
    @IsNumber()
    age?: number;

    @IsOptional()
    @IsDateString()
    dob: string;

    @IsOptional()
    @IsString()
    bio?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    skills?: string[];
}
