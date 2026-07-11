import User from '#models/user'
import { loginValidator, updateSettingsValidator } from '#validators/api/auth'
import { signupValidator } from '#validators/user'
import { isSupportedCurrency } from '#services/currencies'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Token-based authentication for the mobile client. Issues opaque bearer
 * access tokens (`hst_…`); only a hash is stored server-side.
 */
export default class AuthController {
  /** Create an account and issue a token. */
  async register({ request, response }: HttpContext) {
    const payload = await request.validateUsing(signupValidator)
    const user = await User.create(payload)
    const token = await User.accessTokens.create(user)

    return response.created({
      success: true,
      data: { user: user.serialize(), token: token.value!.release() },
    })
  }

  /** Verify credentials and issue a token. */
  async login({ request, response }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)
    // Throws E_INVALID_CREDENTIALS (mapped to a generic 401 in the handler).
    const user = await User.verifyCredentials(email, password)
    const token = await User.accessTokens.create(user)

    return response.ok({
      success: true,
      data: { user: user.serialize(), token: token.value!.release() },
    })
  }

  /** The authenticated user's profile. */
  async me({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    return response.ok({ success: true, data: { user: user.serialize() } })
  }

  /**
   * Update the authenticated user's settings (default currency, full name).
   * User-scoped — only ever touches `auth.user`. `defaultCurrency` is
   * normalized to upper-case and restricted to the supported allow-list.
   */
  async updateSettings({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(updateSettingsValidator)

    if (payload.defaultCurrency !== undefined) {
      const code = payload.defaultCurrency.toUpperCase()
      if (!isSupportedCurrency(code)) {
        return response.unprocessableEntity({
          success: false,
          message: 'unsupported_currency',
          data: {},
        })
      }
      user.defaultCurrency = code
    }
    if (payload.fullName !== undefined) user.fullName = payload.fullName

    await user.save()
    return response.ok({ success: true, data: { user: user.serialize() } })
  }

  /** Revoke the current token. */
  async logout({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const current = (user as any).currentAccessToken
    if (current) await User.accessTokens.delete(user, current.identifier)
    return response.ok({ success: true, data: {} })
  }

  /** Rotate: issue a fresh token and revoke the current one. */
  async refresh({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const current = (user as any).currentAccessToken
    const token = await User.accessTokens.create(user)
    if (current) await User.accessTokens.delete(user, current.identifier)
    return response.ok({ success: true, data: { token: token.value!.release() } })
  }
}
