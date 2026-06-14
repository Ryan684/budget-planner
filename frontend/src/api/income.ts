import { apiFetch } from './client'
import type { IncomeRead, IncomeCreate, IncomeUpdate } from './types'

export function listIncome(monthId: number): Promise<IncomeRead[]> {
  return apiFetch(`/months/${monthId}/income`)
}

export function createIncome(monthId: number, body: IncomeCreate): Promise<IncomeRead> {
  return apiFetch(`/months/${monthId}/income`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateIncome(id: number, body: IncomeUpdate): Promise<IncomeRead> {
  return apiFetch(`/income/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function deleteIncome(id: number): Promise<void> {
  return apiFetch(`/income/${id}`, { method: 'DELETE' })
}
