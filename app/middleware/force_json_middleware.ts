import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Forces the `/api/v1` surface to negotiate as JSON. Setting the `Accept`
 * header makes AdonisJS serialize validation errors and exceptions as JSON
 * (instead of HTML), so the mobile client always receives a JSON envelope.
 */
export default class ForceJsonMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    ctx.request.request.headers['accept'] = 'application/json'
    return next()
  }
}
