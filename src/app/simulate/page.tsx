'use client'

import { useState, useRef, useEffect } from 'react'
import styles from './simulate.module.css'

type Message = { role: 'user' | 'bot'; text: string }

function renderTextWithLinks(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g)
  return parts.map((part, i) => {
    if (/^https?:\/\/[^\s]+$/.test(part)) {
      return (
        <a key={`${part}-${i}`} href={part} target="_blank" rel="noopener noreferrer" className={styles.link}>
          {part}
        </a>
      )
    }
    return <span key={`${i}-${part}`}>{part}</span>
  })
}

export default function SimulatePage() {
  const [phone, setPhone] = useState('+15551234567')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMsg(override?: string) {
    const text = (override ?? input).trim()
    if (!text || loading) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text }])
    setLoading(true)

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message: text }),
      })
      const data = await res.json()
      setMessages((m) => [...m, { role: 'bot', text: data.reply ?? data.error ?? 'No response' }])
    } catch {
      setMessages((m) => [...m, { role: 'bot', text: 'Network error — is the dev server running?' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>SMS Simulator</h1>
      <p className={styles.subtitle}>
        Test the full conversation flow without Twilio or WhatsApp. Messages go through the real state
        machine and database.
      </p>

      <label className={styles.phoneLabel}>
        Simulated phone
        <input
          className={styles.phoneInput}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+15551234567"
        />
      </label>

      <div className={styles.chat}>
        {messages.length === 0 && (
          <div className={styles.empty}>
            <p>Send <strong>A</strong> for NYC→SFO (Fridays) or <strong>B</strong> for SFO→NYC (Sundays).</p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.75rem' }}>
              <button className={styles.sendBtn} onClick={() => sendMsg('A')}>Route A (NYC→SFO)</button>
              <button className={styles.sendBtn} onClick={() => sendMsg('B')}>Route B (SFO→NYC)</button>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? styles.userBubble : styles.botBubble}>
            <span className={styles.label}>{m.role === 'user' ? 'You' : 'Bot'}</span>
            <div className={styles.text}>{renderTextWithLinks(m.text)}</div>
          </div>
        ))}
        {loading && <div className={styles.botBubble}><span className={styles.label}>Bot</span><div className={styles.text}>...</div></div>}
        <div ref={bottomRef} />
      </div>

      <form
        className={styles.inputRow}
        onSubmit={(e) => {
          e.preventDefault()
          sendMsg()
        }}
      >
        <input
          className={styles.msgInput}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          autoFocus
        />
        <button className={styles.sendBtn} type="submit" disabled={loading}>
          Send
        </button>
      </form>
    </div>
  )
}
