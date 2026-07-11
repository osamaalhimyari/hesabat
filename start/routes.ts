/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'

// Lazy-loaded API controllers (mobile client). Kept separate from the
// generated web-controller registry above.
const AuthController = () => import('#controllers/api/v1/auth_controller')
const ContactsController = () => import('#controllers/api/v1/contacts_controller')
const LedgersController = () => import('#controllers/api/v1/ledgers_controller')
const TransactionsController = () => import('#controllers/api/v1/transactions_controller')
const SummaryController = () => import('#controllers/api/v1/summary_controller')

router.on('/').render('pages/home').as('home')

router
  .group(() => {
    router.get('signup', [controllers.NewAccount, 'create'])
    router.post('signup', [controllers.NewAccount, 'store'])

    router.get('login', [controllers.Session, 'create'])
    router.post('login', [controllers.Session, 'store'])
  })
  .use(middleware.guest())

router
  .group(() => {
    router.post('logout', [controllers.Session, 'destroy'])
  })
  .use(middleware.auth())

/*
|--------------------------------------------------------------------------
| JSON API v1 (mobile client — bearer token auth)
|--------------------------------------------------------------------------
*/
router
  .group(() => {
    // ---- public auth ----
    router.post('/auth/register', [AuthController, 'register'])
    router.post('/auth/login', [AuthController, 'login'])

    // ---- authenticated ----
    router
      .group(() => {
        router.post('/auth/logout', [AuthController, 'logout'])
        router.get('/auth/me', [AuthController, 'me'])
        router.post('/auth/refresh', [AuthController, 'refresh'])
        router.patch('/me/settings', [AuthController, 'updateSettings'])

        router.get('/contacts', [ContactsController, 'index'])
        router.post('/contacts', [ContactsController, 'store'])
        router.post('/contacts/import', [ContactsController, 'bulkImport'])
        router.get('/contacts/:id', [ContactsController, 'show'])
        router.patch('/contacts/:id', [ContactsController, 'update'])
        router.delete('/contacts/:id', [ContactsController, 'destroy'])

        router.get('/contacts/:contactId/ledgers', [LedgersController, 'index'])
        router.get('/contacts/:contactId/ledgers/current', [LedgersController, 'current'])
        router.post('/contacts/:contactId/ledgers', [LedgersController, 'store'])
        router.get('/ledgers/:id', [LedgersController, 'show'])
        router.patch('/ledgers/:id', [LedgersController, 'update'])
        router.post('/ledgers/:id/archive', [LedgersController, 'archive'])
        router.post('/ledgers/:id/reopen', [LedgersController, 'reopen'])

        router.get('/ledgers/:ledgerId/transactions', [TransactionsController, 'index'])
        router.post('/ledgers/:ledgerId/transactions', [TransactionsController, 'store'])
        router.get('/transactions/:id', [TransactionsController, 'show'])
        router.patch('/transactions/:id', [TransactionsController, 'update'])
        router.delete('/transactions/:id', [TransactionsController, 'destroy'])

        router.get('/contacts/:contactId/summary', [SummaryController, 'contact'])
        router.get('/summary', [SummaryController, 'global'])
      })
      .use(middleware.auth({ guards: ['api'] }))
  })
  .prefix('/api/v1')
  .use(middleware.forceJson())
