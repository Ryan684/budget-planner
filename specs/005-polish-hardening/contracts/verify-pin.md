# Contract: PIN gate endpoints

Frontend-only access gate, backend-verified. The rest of the API is **not** authenticated (MVP;
security relies on the Tailscale/LAN boundary — see spec Assumptions). The PIN value is never sent
to the client.

## `GET /api/pin-required`

Tells the frontend whether to show the gate, without revealing the PIN.

- **Response 200**: `{ "required": boolean }` — `true` iff `settings.app_pin` is non-blank.
- No request body. Safe to call on every app load.

## `POST /api/verify-pin`

Verifies an entered PIN against `settings.app_pin` server-side.

- **Request**: `{ "pin": string }` (Pydantic schema `PinVerifyRequest`).
- **Response 200**: `{ "ok": boolean }`
  - `ok: true` — PIN matches (constant-time compare via `hmac.compare_digest`).
  - `ok: false` — well-formed attempt, wrong PIN. **Not** an HTTP error (a wrong PIN is a normal
    negative result, so the frontend distinguishes "wrong PIN" from "server/network error").
- **Response 400**: PIN not configured (`app_pin` blank). Defensive — the frontend learns this from
  `pin-required` and should not call `verify-pin` when disabled.
- **Response 422**: malformed body (missing `pin`, non-string).

### Behaviour notes

- No lockout / throttling in the MVP (spec Assumptions).
- The endpoint neither sets a cookie nor issues a token — unlock state lives in the browser session
  only. A determined client can call the rest of the API without unlocking; this is the accepted
  MVP posture.
- The PIN MUST NOT appear in logs, Claude context, or backup exports (FR-005).

### Frontend flow

```
load app
  → GET /api/pin-required
      required=false → render app (FR-002)
      required=true  → render PinGate
          submit PIN → POST /api/verify-pin {pin}
              200 {ok:true}  → mark session unlocked (sessionStorage) → render app (FR-003)
              200 {ok:false} → show "Incorrect PIN", stay locked (FR-004)
              network/5xx    → show retryable error (do NOT reveal data)
```
