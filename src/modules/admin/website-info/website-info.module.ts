import { forwardRef, Module } from '@nestjs/common';
import { WebsiteInfoService } from './website-info.service';
import { WebsiteInfoController } from './website-info.controller';
import { UserModule } from 'src/common/repository/user/user.module';

@Module({
  imports: [forwardRef(() => UserModule)],
  controllers: [WebsiteInfoController],
  providers: [WebsiteInfoService],
})
export class WebsiteInfoModule { }
