import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

const DATABASE_CONNECTION_ERROR_CODES = new Set([
  'P1001',
  'P1002',
  'P2024',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
]);

function isDatabaseConnectionError(exception: unknown): boolean {
  const seen = new Set<object>();
  let current = exception;

  while (typeof current === 'object' && current !== null && !seen.has(current)) {
    seen.add(current);

    if (
      'code' in current &&
      typeof current.code === 'string' &&
      DATABASE_CONNECTION_ERROR_CODES.has(current.code)
    ) {
      return true;
    }

    if (
      'message' in current &&
      typeof current.message === 'string' &&
      /can't reach database server|database.*(?:connection|timeout)|connection.*(?:timeout|refused|reset|closed|terminated|unexpectedly)|timeout expired/i.test(
        current.message,
      )
    ) {
      return true;
    }

    current = 'cause' in current ? current.cause : undefined;
  }

  return false;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred.';

    if (isDatabaseConnectionError(exception)) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      code = 'DATABASE_UNAVAILABLE';
      message = 'The service is temporarily unavailable. Please try again shortly.';
      this.logger.error(
        'Database connection failed while handling a request.',
        exception instanceof Error ? exception.stack : undefined,
      );
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        if (typeof resObj.message === 'string') {
          message = resObj.message;
        } else if (Array.isArray(resObj.message)) {
          message = resObj.message.join('; ');
        }
        if (typeof resObj.error === 'string') {
          code = resObj.error.toUpperCase().replace(/\s+/g, '_');
        }
      }
      code = this.getErrorCode(status, code);
    } else {
      this.logger.error(
        'Unhandled exception while handling a request.',
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      error: {
        code,
        message,
      },
    });
  }

  private getErrorCode(status: number, fallbackCode: string): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'INVALID_TRANSITION';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'TOO_MANY_REQUESTS';
      default:
        return fallbackCode;
    }
  }
}
