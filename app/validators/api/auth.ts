import vine from '@vinejs/vine'

/**
 * Login only needs credentials. `signupValidator` (in #validators/user) is
 * reused for registration.
 */
export const loginValidator = vine.create({
  email: vine.string().trim().email().maxLength(254),
  password: vine.string(),
})
