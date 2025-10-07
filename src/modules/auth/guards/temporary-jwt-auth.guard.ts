import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import appConfig from '../../../config/app.config';

@Injectable()
export class TemporaryJwtAuthGuard extends AuthGuard('jwt') {
  constructor(private jwtService: JwtService) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    // Use the parent JWT guard to handle token validation
    const result = super.canActivate(context);
    
    if (typeof result === 'boolean') {
      return this.validateUser(context, result);
    }

    // Handle both Promise and Observable
    if (result instanceof Promise) {
      return result.then((isValid) => this.validateUser(context, isValid));
    }

    // Handle Observable
    return result.pipe(
      map((isValid) => this.validateUser(context, isValid))
    );
  }

  private validateUser(context: ExecutionContext, isValid: boolean): boolean {
    if (isValid) {
      const request = context.switchToHttp().getRequest();
      
      // The JWT strategy already validated the token and set the user
      // We just need to ensure it's either a regular JWT or a temporary JWT
      if (request.user && (request.user.type === 'temporary' || !request.user.type)) {
        return true;
      } else {
        return false;
      }
    }
    return false;
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
