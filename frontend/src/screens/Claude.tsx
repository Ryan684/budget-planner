import { useState } from 'react'
import type { FormEvent } from 'react'
import { useClaudeSession } from '../hooks/useClaudeSession'
import styles from './Claude.module.css'

export function ClaudeScreen() {
  const { messages, sending, error, canUndo, send, undoLast } = useClaudeSession()
  const [draft, setDraft] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const text = draft
    setDraft('')
    // A failed turn puts the message back so it can be resent without retyping.
    void send(text).then(ok => {
      if (!ok) setDraft(text)
    })
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Claude</h1>
      </div>

      <div className={styles.messages}>
        {messages.length === 0 ? (
          <p className={styles.hint}>
            Ask about your budget — surplus, savings, forecasts — or ask me to add or change a
            bill for this month.
          </p>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={m.role === 'user' ? styles.userBubble : styles.assistantBubble}
            >
              {m.content}
            </div>
          ))
        )}
        {sending && <div className={styles.assistantBubble}>…</div>}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {canUndo && (
        <button
          type="button"
          className={styles.undo}
          onClick={() => void undoLast()}
          disabled={sending}
        >
          Undo last Claude change
        </button>
      )}

      <form className={styles.composer} onSubmit={onSubmit}>
        <input
          className={styles.input}
          type="text"
          value={draft}
          placeholder="Ask Claude…"
          onChange={e => setDraft(e.target.value)}
          aria-label="Message Claude"
        />
        <button
          className={styles.send}
          type="submit"
          disabled={sending || draft.trim() === ''}
        >
          Send
        </button>
      </form>
    </div>
  )
}
