import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'auth.register': { paramsTuple?: []; params?: {} }
    'auth.login': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'auth.me': { paramsTuple?: []; params?: {} }
    'auth.refresh': { paramsTuple?: []; params?: {} }
    'auth.update_settings': { paramsTuple?: []; params?: {} }
    'contacts.index': { paramsTuple?: []; params?: {} }
    'contacts.store': { paramsTuple?: []; params?: {} }
    'contacts.bulk_import': { paramsTuple?: []; params?: {} }
    'contacts.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'contacts.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'contacts.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ledgers.index': { paramsTuple: [ParamValue]; params: {'contactId': ParamValue} }
    'ledgers.current': { paramsTuple: [ParamValue]; params: {'contactId': ParamValue} }
    'ledgers.store': { paramsTuple: [ParamValue]; params: {'contactId': ParamValue} }
    'ledgers.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ledgers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ledgers.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ledgers.reopen': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'transactions.index': { paramsTuple: [ParamValue]; params: {'ledgerId': ParamValue} }
    'transactions.store': { paramsTuple: [ParamValue]; params: {'ledgerId': ParamValue} }
    'transactions.feed': { paramsTuple?: []; params?: {} }
    'transactions.store_personal': { paramsTuple?: []; params?: {} }
    'transactions.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'transactions.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'transactions.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'summary.contact': { paramsTuple: [ParamValue]; params: {'contactId': ParamValue} }
    'summary.global': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'auth.me': { paramsTuple?: []; params?: {} }
    'contacts.index': { paramsTuple?: []; params?: {} }
    'contacts.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ledgers.index': { paramsTuple: [ParamValue]; params: {'contactId': ParamValue} }
    'ledgers.current': { paramsTuple: [ParamValue]; params: {'contactId': ParamValue} }
    'ledgers.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'transactions.index': { paramsTuple: [ParamValue]; params: {'ledgerId': ParamValue} }
    'transactions.feed': { paramsTuple?: []; params?: {} }
    'transactions.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'summary.contact': { paramsTuple: [ParamValue]; params: {'contactId': ParamValue} }
    'summary.global': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'auth.me': { paramsTuple?: []; params?: {} }
    'contacts.index': { paramsTuple?: []; params?: {} }
    'contacts.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ledgers.index': { paramsTuple: [ParamValue]; params: {'contactId': ParamValue} }
    'ledgers.current': { paramsTuple: [ParamValue]; params: {'contactId': ParamValue} }
    'ledgers.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'transactions.index': { paramsTuple: [ParamValue]; params: {'ledgerId': ParamValue} }
    'transactions.feed': { paramsTuple?: []; params?: {} }
    'transactions.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'summary.contact': { paramsTuple: [ParamValue]; params: {'contactId': ParamValue} }
    'summary.global': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'auth.register': { paramsTuple?: []; params?: {} }
    'auth.login': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'auth.refresh': { paramsTuple?: []; params?: {} }
    'contacts.store': { paramsTuple?: []; params?: {} }
    'contacts.bulk_import': { paramsTuple?: []; params?: {} }
    'ledgers.store': { paramsTuple: [ParamValue]; params: {'contactId': ParamValue} }
    'ledgers.archive': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ledgers.reopen': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'transactions.store': { paramsTuple: [ParamValue]; params: {'ledgerId': ParamValue} }
    'transactions.store_personal': { paramsTuple?: []; params?: {} }
  }
  PATCH: {
    'auth.update_settings': { paramsTuple?: []; params?: {} }
    'contacts.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ledgers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'transactions.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  DELETE: {
    'contacts.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'transactions.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}