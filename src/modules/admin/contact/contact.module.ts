import { forwardRef, Module } from '@nestjs/common';
import { ContactService } from './contact.service';
import { ContactController } from './contact.controller';
import { UserModule } from 'src/common/repository/user/user.module';

@Module({
  imports: [forwardRef(() => UserModule)],
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule { }
