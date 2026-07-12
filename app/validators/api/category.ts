import vine from '@vinejs/vine'

export const createCategoryValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(64),
})
