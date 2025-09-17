import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  canActivate(context: ExecutionContext) {
    // Normalize request body to ensure identifier field is set
    const request = context.switchToHttp().getRequest();
    if (request && request.body) {
      const { identifier, email, username } = request.body;
      if (!identifier) {
        request.body.identifier = email || username;
      }
    }
    return super.canActivate(context);
  }

  handleRequest(err, user, info, context: ExecutionContext, status) {
    // You can throw an exception based on either "info" or "err" arguments
    const request = context.switchToHttp().getRequest();
    const { identifier, email, username, password } = request.body;

    if (err || !user) {
      if (!identifier && !email && !username) {
        throw new HttpException(
          { message: 'identifier, email or username not provided' },
          HttpStatus.BAD_REQUEST,
        );
      } else if (!password) {
        throw new HttpException(
          { message: 'password not provided' },
          HttpStatus.BAD_REQUEST,
        );
      } else {
        throw err || new UnauthorizedException();
      }
    }
    return user;
  }
}
