import { apiFetch } from './client'
import type { AccountRead, AccountCreate, AccountUpdate, AccountList } from './types'

export function listAccounts(): Promise<AccountList> {
  return apiFetch('/accounts')
}

export function createAccount(body: AccountCreate): Promise<AccountRead> {
  return apiFetch('/accounts', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateAccount(id: number, body: AccountUpdate): Promise<AccountRead> {
  return apiFetch(`/accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function deleteAccount(id: number): Promise<void> {
  return apiFetch(`/accounts/${id}`, { method: 'DELETE' })
}
