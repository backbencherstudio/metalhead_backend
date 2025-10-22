import { Module } from '@nestjs/common';
import { UcodeRepository } from './ucode.repository';

@Module({
    providers: [UcodeRepository],
    exports: [UcodeRepository],
})
export class UcodeModule { }
