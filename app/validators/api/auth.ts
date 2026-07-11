import vine from '@vinejs/vine'

/**
 * Login only needs credentials. `signupValidator` (in #validators/user) is
 * reused for registration.
 */
export const loginValidator = vine.create({
  email: vine.string().trim().email().maxLength(254),
  password: vine.string(),
})

/**
 * Update the authenticated user's settings. Both fields are optional so the
 * client can patch just one. `defaultCurrency` is length-checked here and
 * allow-list-checked in the controller (see `#services/currencies`).
 */
export const updateSettingsValidator = vine.create({
  defaultCurrency: vine.string().trim().fixedLength(3).optional(),
  fullName: vine.string().trim().maxLength(254).nullable().optional(),
})
