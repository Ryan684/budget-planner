# Contract — Frontend API Client (consumes the Phase 1 REST API)

The frontend is a pure consumer of the Phase 1 backend. This is the typed client surface
(`src/api/*`) the UI depends on. Every function returns parsed JSON typed per `data-model.md`;
non-2xx responses throw a typed `ApiError { status, message, detail? }`. Base URL comes from
`import.meta.env.VITE_API_BASE_URL` (dev: Vite proxies `/api` → `http://localhost:8000`, so the
base is the relative `/api`).

## Endpoints (verbatim from `backend/routers/*`)

### Months — `src/api/months.ts`
| Function | Method & path | Body | Returns | Errors |
|---|---|---|---|---|
| `listMonths()` | `GET /api/months` | — | `MonthRead[]` (asc by `month`) | — |
| `createMonth(payload)` | `POST /api/months` | `MonthCreate` | `MonthRead` (201) | `409` duplicate; `422` bad month/override |
| `carryForwardPreview(month)` | `GET /api/months/carry-forward-preview?month=YYYY-MM` | — | `CarryForwardPreview` | `422` bad month |
| `getMonth(id)` | `GET /api/months/{id}` | — | `MonthRead` | `404` |
| `updateMonth(id, payload)` | `PATCH /api/months/{id}` | `MonthUpdate` | `MonthRead` | `404` |
| `deleteMonth(id)` | `DELETE /api/months/{id}` | — | `204` | `404` |
| `monthSummary(id)` | `GET /api/months/{id}/summary` | — | `BudgetSummary` | `404` |
| `monthDetail(id)` | `GET /api/months/{id}/detail` | — | `MonthDetail` | `404` |

### Income — `src/api/income.ts`
| Function | Method & path | Body | Returns | Errors |
|---|---|---|---|---|
| `listIncome(monthId)` | `GET /api/months/{monthId}/income` | — | `IncomeRead[]` | `404` month |
| `createIncome(monthId, body)` | `POST /api/months/{monthId}/income` | `IncomeCreate` | `IncomeRead` (201) | `404` month; `422` amount<0 |
| `updateIncome(id, body)` | `PATCH /api/income/{id}` | `IncomeUpdate` | `IncomeRead` | `404`; `422` |
| `deleteIncome(id)` | `DELETE /api/income/{id}` | — | `204` | `404` |

### Bills — `src/api/bills.ts`
| Function | Method & path | Body | Returns | Errors |
|---|---|---|---|---|
| `listBills(monthId)` | `GET /api/months/{monthId}/bills` | — | `BillRead[]` (server-ordered by category, due_date) | `404` month |
| `createBill(monthId, body)` | `POST /api/months/{monthId}/bills` | `BillCreate` | `BillRead` (201) | `404` month; `422` amount<0 / due 1–31 |
| `updateBill(id, body)` | `PATCH /api/bills/{id}` | `BillUpdate` | `BillRead` | `404`; `422` |
| `deleteBill(id)` | `DELETE /api/bills/{id}` | — | `204` | `404` |

### Accounts — `src/api/accounts.ts` (not month-scoped)
| Function | Method & path | Body | Returns | Errors |
|---|---|---|---|---|
| `listAccounts()` | `GET /api/accounts` | — | `AccountList` (accounts + totals) | — |
| `createAccount(body)` | `POST /api/accounts` | `AccountCreate` | `AccountRead` (201) | `422` balance<0 |
| `updateAccount(id, body)` | `PATCH /api/accounts/{id}` | `AccountUpdate` | `AccountRead` | `404`; `422` |
| `deleteAccount(id)` | `DELETE /api/accounts/{id}` | — | `204` | `404` |

On account create/update the UI passes `active_month_id` = the current editable month id so the
amendment is stamped against the right month (server falls back to the latest month otherwise).

### Amendments — `src/api/amendments.ts`
| Function | Method & path | Returns | Errors |
|---|---|---|---|
| `listAmendments(monthId)` | `GET /api/months/{monthId}/amendments` | `AmendmentRead[]` (newest first) | `404` month |

## Client behaviour contract (`src/api/client.ts`)

- Sends/parses `application/json`; `DELETE` (204) resolves to `void`.
- Throws `ApiError` on non-2xx with `status` and a human-readable `message` derived from FastAPI's
  `detail` (string or validation-array). Screens map: `422`→inline validation message,
  `404`→not-found, `409`→"That month already exists".
- No retries, no caching — callers (hooks) re-fetch after writes.

## Out of contract this phase
No `/api/claude` usage (Phase 3). No backend route/schema changes — if a screen appears to need
data the API doesn't expose, raise it rather than adding backend scope.
