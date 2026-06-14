import { apiFetch } from './client'
import type { BillRead, BillCreate, BillUpdate } from './types'

export function listBills(monthId: number): Promise<BillRead[]> {
  return apiFetch(`/months/${monthId}/bills`)
}

export function createBill(monthId: number, body: BillCreate): Promise<BillRead> {
  return apiFetch(`/months/${monthId}/bills`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateBill(id: number, body: BillUpdate): Promise<BillRead> {
  return apiFetch(`/bills/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function deleteBill(id: number): Promise<void> {
  return apiFetch(`/bills/${id}`, { method: 'DELETE' })
}
