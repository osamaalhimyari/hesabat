import { defineConfig } from '@adonisjs/auth'
import { sessionGuard, sessionUserProvider } from '@adonisjs/auth/session'
import { tokensGuard, tokensUserProvider } from '@adonisjs/auth/access_tokens'
import type { InferAuthenticators, InferAuthEvents, Authenticators } from '@adonisjs/auth/types'

/**
 * Authentication configuration.
 *
 * Two guards are configured:
 * - `web` — session/cookie auth for the existing server-rendered Edge pages.
 * - `api` — stateless bearer access tokens for the Flutter mobile client
 *           (routes under `/api/v1`). Only a hash of each token is persisted,
 *           in the `auth_access_tokens` table via `User.accessTokens`.
 */
const authConfig = defineConfig({
  /**
   * The default guard to use for authentication.
   * This guard will be used when no specific guard is mentioned.
   */
  default: 'web',

  guards: {
    /**
     * Web guard uses session-based authentication for web requests.
     */
    web: sessionGuard({
      /**
       * Whether to use "remember me" tokens for persistent authentication.
       * When enabled, users can stay logged in across browser sessions.
       */
      useRememberMeTokens: false,

      /**
       * User provider configuration.
       * Defines how to fetch and verify user credentials.
       */
      provider: sessionUserProvider({
        model: () => import('#models/user'),
      }),
    }),

    /**
     * API guard uses opaque bearer access tokens for the mobile client.
     */
    api: tokensGuard({
      provider: tokensUserProvider({
        tokens: 'accessTokens',
        model: () => import('#models/user'),
      }),
    }),
  },
})

export default authConfig

/**
 * Inferring types from the configured auth
 * guards.
 */
declare module '@adonisjs/auth/types' {
  export interface Authenticators extends InferAuthenticators<typeof authConfig> {}
}
declare module '@adonisjs/core/types' {
  interface EventsList extends InferAuthEvents<Authenticators> {}
}
