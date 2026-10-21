import {
  type ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request } from 'express';

const UNKNOWN_ERROR_MESSAGE = 'Internal server error';

// Registra los errores >= 500 en una línea JSON y deja la respuesta al cliente como la daba Nest.
// Nunca se registran cuerpo, cabeceras, cookies ni query string; los 4xx no se registran.
@Catch()
export class ServerErrorFilter extends BaseExceptionFilter {
  private readonly errorLogger = new Logger('ServerError');

  override catch(exception: unknown, host: ArgumentsHost): void {
    const status = this.statusOf(exception);
    if (status >= 500) {
      this.log(exception, status, host);
    }
    if (!(exception instanceof HttpException) && !this.isHttpError(exception)) {
      // Misma respuesta que el manejo por defecto, pero sin su línea de log duplicada
      super.catch(
        new HttpException(
          { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: UNKNOWN_ERROR_MESSAGE },
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
        host,
      );
      return;
    }
    super.catch(exception, host);
  }

  private statusOf(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    if (this.isHttpError(exception)) {
      return (exception as { statusCode: number }).statusCode;
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private log(exception: unknown, status: number, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<Request>();
    const error = exception instanceof Error ? exception : undefined;
    const rawPath = request.originalUrl ?? request.url ?? '';
    this.errorLogger.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        method: request.method,
        path: rawPath.split('?')[0],
        status,
        errorName: error?.name ?? typeof exception,
        message: error?.message ?? String(exception),
        stack: error?.stack,
      }),
    );
  }
}
