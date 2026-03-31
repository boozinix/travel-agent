'use client'

import { useState, useRef, useEffect } from 'react'
import styles from './simulate.module.css'

type Message = { role: 'user' | 'bot'; text: string }

export default function SimulatePage() {
  const [phone, setPhone] = useState('+15551234567')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
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
          <p className={styles.empty}>
            Send a message to start. Try &quot;NYC to SFO&quot; then a date like &quot;2026-05-01&quot;.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? styles.userBubble : styles.botBubble}>
            <span className={styles.label}>{m.role === 'user' ? 'You' : 'Bot'}</span>
            <div className={styles.text}>{m.text}</div>
          </div>
        ))}
        {loading && <div className={styles.botBubble}><span className={styles.label}>Bot</span><div className={styles.text}>...</div></div>}
        <div ref={bottomRef} />
      </div>

      <form
        className={styles.inputRow}
        onSubmit={(e) => {
          e.preventDefault()
          send()
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
