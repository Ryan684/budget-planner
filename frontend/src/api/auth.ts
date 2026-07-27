import { apiFetch } from './client'
import type { PinRequiredResponse, PinVerifyResponse } from './types'

/** Whether a PIN is configured on the backend. Never returns the PIN itself. */
export function pinRequired(): Promise<PinRequiredResponse> {
  return apiFetch('/pin-required')
}

/** Check an entered PIN server-side, so the configured value never ships here. */
export function verifyPin(pin: string): Promise<PinVerifyResponse> {
  return apiFetch('/verify-pin', {
    method: 'POST',
    body: JSON.stringify({ pin }),
  })
}
