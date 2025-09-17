import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ 
      usernameField: 'identifier',
      passReqToCallback: true 
    });
  }

  async validate(req: any, identifier: string, password: string): Promise<any> {
    try {
      // Support identifier, email, or username from request body
      const effectiveIdentifier = req?.body?.identifier || req?.body?.email || req?.body?.username || identifier;
      const token = req?.body?.token || req?.body?.twoFactorToken || req?.body?.otp;
      
      const user = await this.authService.validateUser(effectiveIdentifier, password, token);

      return user;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }
}
