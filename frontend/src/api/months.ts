import { apiFetch } from './client'
import type {
  MonthRead,
  MonthCreate,
  MonthUpdate,
  BudgetSummary,
  MonthDetail,
  CarryForwardPreview,
} from './types'

export function listMonths(): Promise<MonthRead[]> {
  return apiFetch('/months')
}

export function createMonth(payload: MonthCreate): Promise<MonthRead> {
  return apiFetch('/months', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function carryForwardPreview(month: string): Promise<CarryForwardPreview> {
  return apiFetch(`/months/carry-forward-preview?month=${encodeURIComponent(month)}`)
}

export function getMonth(id: number): Promise<MonthRead> {
  return apiFetch(`/months/${id}`)
}

export function updateMonth(id: number, payload: MonthUpdate): Promise<MonthRead> {
  return apiFetch(`/months/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteMonth(id: number): Promise<void> {
  return apiFetch(`/months/${id}`, { method: 'DELETE' })
}

export function monthSummary(id: number): Promise<BudgetSummary> {
  return apiFetch(`/months/${id}/summary`)
}

export function monthDetail(id: number): Promise<MonthDetail> {
  return apiFetch(`/months/${id}/detail`)
}
