import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UserRepository } from './user.repository';
import { AuthModule } from 'src/modules/auth/auth.module';

@Module({
    imports: [
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'secret-key',
            signOptions: { expiresIn: '7d' },
        }),
        forwardRef(() => AuthModule),
    ],
    providers: [UserRepository],
    exports: [UserRepository],
})
export class UserModule { }
