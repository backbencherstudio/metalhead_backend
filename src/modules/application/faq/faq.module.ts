import { forwardRef, Module } from '@nestjs/common';
import { FaqService } from './faq.service';
import { FaqController } from './faq.controller';
import { UserModule } from 'src/common/repository/user/user.module';

@Module({
  imports: [forwardRef(() => UserModule)],
  controllers: [FaqController],
  providers: [FaqService],
})
export class FaqModule { }
