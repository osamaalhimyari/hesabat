import app from '@adonisjs/core/services/app'
import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import type { StatusPageRange, StatusPageRenderer } from '@adonisjs/core/types/http'

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * Status pages are used to display a custom HTML pages for certain error
   * codes. You might want to enable them in production only, but feel
   * free to enable them in development as well.
   */
  protected renderStatusPages = app.inProduction

  /**
   * Status pages is a collection of error code range and a callback
   * to return the HTML contents to send as a response.
   */
  protected statusPages: Record<StatusPageRange, StatusPageRenderer> = {
    '404': (error, { view }) => {
      return view.render('pages/errors/not_found', { error })
    },
    '500..599': (error, { view }) => {
      return view.render('pages/errors/server_error', { error })
    },
  }

  /**
   * The method is used for handling errors and returning
   * response to the client.
   *
   * For the `/api` surface we always answer with the JSON envelope the mobile
   * client expects: `{ success: false, message, errors? }`. `message` is a
   * stable, translatable key. Web routes keep their default HTML behavior.
   */
  async handle(error: unknown, ctx: HttpContext) {
    if (ctx.request.url().startsWith('/api')) {
      const err = error as { code?: string; status?: number; message?: string; messages?: unknown }
      const code = err?.code

      if (code === 'E_VALIDATION_ERROR') {
        return ctx.response.status(422).send({
          success: false,
          message: 'validation_failed',
          errors: err.messages ?? [],
        })
      }
      if (code === 'E_INVALID_CREDENTIALS') {
        // Generic message + 401 to avoid user enumeration.
        return ctx.response.status(401).send({ success: false, message: 'invalid_credentials' })
      }
      if (code === 'E_UNAUTHORIZED_ACCESS' || err?.status === 401) {
        return ctx.response.status(401).send({ success: false, message: 'unauthorized' })
      }
      if (code === 'E_AUTHORIZATION_FAILURE' || err?.status === 403) {
        return ctx.response.status(403).send({ success: false, message: 'forbidden' })
      }
      if (code === 'E_ROUTE_NOT_FOUND' || err?.status === 404) {
        return ctx.response.status(404).send({ success: false, message: 'not_found' })
      }

      const status = typeof err?.status === 'number' ? err.status : 500
      const message =
        status >= 500 ? (this.debug ? String(err?.message ?? 'server_error') : 'server_error') : String(err?.message ?? 'error')
      return ctx.response.status(status).send({ success: false, message })
    }

    return super.handle(error, ctx)
  }

  /**
   * The method is used to report error to the logging service or
   * the a third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   */
  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
