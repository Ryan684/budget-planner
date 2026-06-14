import { apiFetch } from './client'
import type { AmendmentRead } from './types'

export function listAmendments(monthId: number): Promise<AmendmentRead[]> {
  return apiFetch(`/months/${monthId}/amendments`)
}
