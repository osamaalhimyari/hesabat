import type { HttpContext } from '@adonisjs/core/http'
import {
  contactSummary,
  dashboardOverview,
  type CurrencyBalance,
  type CurrencySummary,
} from '#services/balance_service'
import { formatMinor } from '#services/money'

/**
 * Aggregated lend-vs-borrow totals per currency — powers the summary chart on
 * the contact detail header and the global summary tab.
 */
export default class SummaryController {
  /** Per-currency totals for one contact (its active ledger, or a given ledger). */
  async contact({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    // Ensure the contact belongs to the user (404 otherwise).
    await user.related('contacts').query().where('id', params.contactId).firstOrFail()

    const ledgerIdRaw = request.input('ledgerId')
    const ledgerId = ledgerIdRaw ? Number(ledgerIdRaw) : undefined
    const summaries = await contactSummary(user.id, Number(params.contactId), ledgerId)

    return response.ok({ success: true, data: { summary: summaries.map(shape) } })
  }

  /**
   * The Home dashboard overview: personal cash wallet + total to-pay/to-receive
   * debts, per currency. Powers the colored balance circles.
   */
  async global({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const overview = await dashboardOverview(user.id)
    return response.ok({
      success: true,
      data: {
        overview: {
          defaultCurrency: user.defaultCurrency || 'USD',
          cash: overview.cash.map(shapeBalance),
          toPay: overview.toPay.map(shapeBalance),
          toReceive: overview.toReceive.map(shapeBalance),
          held: overview.held.map(shapeBalance),
          netWorth: overview.netWorth.map(shapeBalance),
        },
      },
    })
  }
}

/** Serialize a per-currency balance with a display string. */
function shapeBalance(b: CurrencyBalance) {
  return { currency: b.currency, minor: b.balanceMinor, display: formatMinor(b.balanceMinor, b.currency) }
}

/** Serialize a currency summary with money display strings + a net direction. */
function shape(s: CurrencySummary) {
  const direction =
    s.netMinor > 0 ? 'owed_to_user' : s.netMinor < 0 ? 'owed_by_user' : 'settled'
  return {
    currency: s.currency,
    totals: {
      lend: { minor: s.totals.lend, display: formatMinor(s.totals.lend, s.currency) },
      borrow: { minor: s.totals.borrow, display: formatMinor(s.totals.borrow, s.currency) },
      receipt: { minor: s.totals.receipt, display: formatMinor(s.totals.receipt, s.currency) },
      expense: { minor: s.totals.expense, display: formatMinor(s.totals.expense, s.currency) },
      // Unlike the repayment totals (which settle amounts already charted), a
      // due is a primary charge — without it on the wire a contact whose only
      // entry is a due would show a non-zero net over an empty chart.
      dueToMe: { minor: s.totals.dueToMe, display: formatMinor(s.totals.dueToMe, s.currency) },
      dueFromMe: {
        minor: s.totals.dueFromMe,
        display: formatMinor(s.totals.dueFromMe, s.currency),
      },
    },
    net: {
      minor: s.netMinor,
      display: formatMinor(s.netMinor, s.currency),
      direction,
    },
    // "My money with him" (custody/أمانة). Like the repayment totals, the three
    // hold per-type totals are deliberately not on the wire — only the net.
    held: {
      minor: s.heldMinor,
      display: formatMinor(s.heldMinor, s.currency),
    },
  }
}
