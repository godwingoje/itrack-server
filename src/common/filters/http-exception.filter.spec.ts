import { HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;

  beforeEach(() => {
    response.status.mockClear();
    response.json.mockClear();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a sanitized 503 for database connection timeouts', () => {
    new HttpExceptionFilter().catch(new Error('timeout expired'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'The service is temporarily unavailable. Please try again shortly.',
      },
    });
  });

  it('returns a sanitized 503 when PostgreSQL terminates a connection', () => {
    new HttpExceptionFilter().catch(
      new Error('Connection terminated unexpectedly'),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'The service is temporarily unavailable. Please try again shortly.',
      },
    });
  });

  it('returns a sanitized 503 for Prisma database-unreachable errors', () => {
    new HttpExceptionFilter().catch(
      Object.assign(new Error('Database connection failed.'), { code: 'P1001' }),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'The service is temporarily unavailable. Please try again shortly.',
      },
    });
  });

  it('keeps unexpected failures as sanitized 500 responses', () => {
    new HttpExceptionFilter().catch(new Error('internal detail'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
  });
});
