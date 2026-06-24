import { apiFetch } from './client'
import type { ClaudeMessage, ClaudeRequest, ClaudeResponse, ClaudeUndoResponse } from './types'

export function postClaudeMessage(
  message: string,
  conversation: ClaudeMessage[],
): Promise<ClaudeResponse> {
  const body: ClaudeRequest = { message, conversation }
  return apiFetch('/claude', { method: 'POST', body: JSON.stringify(body) })
}

export function undoLastClaudeChange(amendmentIds: number[]): Promise<ClaudeUndoResponse> {
  return apiFetch('/claude/undo', {
    method: 'POST',
    body: JSON.stringify({ amendment_ids: amendmentIds }),
  })
}
