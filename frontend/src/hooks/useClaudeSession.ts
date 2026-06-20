import { useState, useCallback } from 'react'
import { postClaudeMessage, undoLastClaudeChange } from '../api/claude'
import type { ClaudeMessage, BudgetSummary } from '../api/types'

export interface UseClaudeSessionResult {
  messages: ClaudeMessage[]
  summary: BudgetSummary | null
  sending: boolean
  error: string | null
  canUndo: boolean
  send: (text: string) => Promise<void>
  undoLast: () => Promise<void>
}

/**
 * Session-scoped Claude state: the running conversation plus the per-turn list of
 * Claude writes (the basis for undo). Nothing is persisted — unmounting the screen
 * resets it (FR-007, FR-019).
 */
export function useClaudeSession(): UseClaudeSessionResult {
  const [messages, setMessages] = useState<ClaudeMessage[]>([])
  const [summary, setSummary] = useState<BudgetSummary | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // One entry per Claude turn that produced writes; each holds that turn's amendment ids.
  const [writeTurns, setWriteTurns] = useState<number[][]>([])

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || sending) return
      setError(null)
      setSending(true)
      // capture prior conversation before showing the new user message
      const priorConversation = messages
      setMessages(prev => [...prev, { role: 'user', content: trimmed }])
      try {
        const res = await postClaudeMessage(trimmed, priorConversation)
        setMessages(prev => [...prev, { role: 'assistant', content: res.reply }])
        if (res.summary) setSummary(res.summary)
        if (res.writes.length > 0) {
          setWriteTurns(prev => [...prev, res.writes.map(w => w.amendment_id)])
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Claude is unavailable right now')
      } finally {
        setSending(false)
      }
    },
    [messages, sending],
  )

  const undoLast = useCallback(async () => {
    if (writeTurns.length === 0 || sending) return
    const lastTurn = writeTurns[writeTurns.length - 1]
    setError(null)
    setSending(true)
    try {
      const res = await undoLastClaudeChange(lastTurn)
      setWriteTurns(prev => prev.slice(0, -1))
      if (res.summary) setSummary(res.summary)
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Reverted my last change.' },
      ])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not undo the last change')
    } finally {
      setSending(false)
    }
  }, [writeTurns, sending])

  return {
    messages,
    summary,
    sending,
    error,
    canUndo: writeTurns.length > 0,
    send,
    undoLast,
  }
}
