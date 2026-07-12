import type { HttpContext } from '@adonisjs/core/http'
import { createCategoryValidator } from '#validators/api/category'

/**
 * User-defined transaction categories. Every query is scoped to the
 * authenticated user (multi-tenant isolation — a foreign id yields 404).
 */
export default class CategoriesController {
  /** List the user's categories, ordered by name. */
  async index({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const categories = await user.related('categories').query().orderBy('name', 'asc')
    return response.ok({
      success: true,
      data: { categories: categories.map((c) => c.serialize()) },
    })
  }

  /** Create a category; a duplicate name for the same user returns 409. */
  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(createCategoryValidator)

    // Pre-check the (user_id, name) unique constraint for a friendly 409.
    const existing = await user
      .related('categories')
      .query()
      .where('name', payload.name)
      .first()
    if (existing) {
      return response.conflict({ success: false, error: 'category_exists' })
    }

    try {
      const category = await user.related('categories').create({ name: payload.name })
      return response.created({ success: true, data: { category: category.serialize() } })
    } catch (error: any) {
      // Guard against a race that slips past the pre-check (unique violation).
      if (error?.code === 'ER_DUP_ENTRY' || error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return response.conflict({ success: false, error: 'category_exists' })
      }
      throw error
    }
  }

  /** Delete a category by id, scoped to the user (404 if not theirs). */
  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const category = await user
      .related('categories')
      .query()
      .where('id', params.id)
      .firstOrFail()
    await category.delete()
    return response.ok({ success: true, data: {} })
  }
}
