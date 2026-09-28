import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger } from '@nestjs/common'
import type { ExceptionFilter } from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp()
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR
    const response = exception instanceof HttpException ? exception.getResponse() : undefined
    let message: string | string[] = 'Internal server error'

    if (status < 500) {
      if (typeof response === 'string') message = response
      else if (response && typeof response === 'object' && 'message' in response) {
        const detail = response.message
        if (typeof detail === 'string' || (Array.isArray(detail) && detail.every((item) => typeof item === 'string'))) {
          message = detail
        }
      }
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : 'Unhandled server error')
    }

    this.adapterHost.httpAdapter.reply(http.getResponse(), { statusCode: status, message }, status)
  }
}
