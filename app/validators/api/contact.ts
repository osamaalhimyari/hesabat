import vine from '@vinejs/vine'

export const createContactValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(254),
  phone: vine.string().trim().maxLength(32).nullable().optional(),
  photoUrl: vine.string().trim().maxLength(1024).nullable().optional(),
})

export const updateContactValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(254).optional(),
  phone: vine.string().trim().maxLength(32).nullable().optional(),
  photoUrl: vine.string().trim().maxLength(1024).nullable().optional(),
})

/** Bulk upsert of device contacts, deduped server-side by deviceContactId. */
export const importContactsValidator = vine.create({
  contacts: vine
    .array(
      vine.object({
        name: vine.string().trim().minLength(1).maxLength(254),
        phone: vine.string().trim().maxLength(32).nullable().optional(),
        deviceContactId: vine.string().trim().maxLength(255),
      })
    )
    .minLength(1)
    .maxLength(500),
})
