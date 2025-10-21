import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch(HttpException)
export class CustomExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Default message values
    let message = 'An unexpected error occurred';
    let error = undefined;

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object') {
        // Pull structured message if provided
        message = res['message'] || message;
        error = res['details'] || res['error'] || undefined;
      }
    } else if (exception.message) {
      message = exception.message;
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      ...(error ? { error } : {}),
    });
  }
}
