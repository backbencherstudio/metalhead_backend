import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import appConfig from '../../../config/app.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // ignoreExpiration: false,
      ignoreExpiration: true,
      secretOrKey: appConfig().jwt.secret,
    });
  }

  async validate(payload: any) {
    // Handle both regular JWTs (with sub) and temporary JWTs (with userId)
    const userId = payload.sub || payload.userId;
    
    return { 
      userId: userId, 
      id: userId,
      name: payload.name,
      email: payload.email, 
      type: payload.type,
      isTemporary: payload.type === 'temporary'
    };
  }
}
