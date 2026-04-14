'use client';
import { useChat } from 'ai/react';
import React from 'react';

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, error } = useChat();

  return (
    <div className="container" style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '2.5rem', background: 'linear-gradient(to right, #60a5fa, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Flight AI Assistant
        </h1>
        <p className="text-muted" style={{ marginTop: '8px' }}>Ask me to find and book your flights in plain English.</p>
      </div>

      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.length === 0 && (
            <div className="text-muted text-center" style={{ margin: 'auto', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
              Say something like:<br/><br/>
              <strong style={{ color: 'var(--primary)' }}>"I want to fly from SFO to NYC tomorrow"</strong>
            </div>
          )}
          
          {messages.map(m => (
            <div key={m.id} style={{
              display: 'flex', 
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start'
            }}>
              <div style={{
                maxWidth: '85%',
                padding: '16px 20px',
                borderRadius: '16px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                lineHeight: '1.5',
                fontSize: '0.95rem',
                whiteSpace: 'pre-wrap',
                background: m.role === 'user' 
                  ? 'linear-gradient(135deg, var(--primary), var(--primary-hover))'
                  : 'rgba(255, 255, 255, 0.05)',
                border: m.role === 'user'
                  ? 'none'
                  : '1px solid var(--card-border)',
                color: m.role === 'user' ? '#fff' : 'var(--foreground)',
                borderBottomRightRadius: m.role === 'user' ? '4px' : '16px',
                borderBottomLeftRadius: m.role === 'user' ? '16px' : '4px',
              }}>
                {m.content}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '12px', marginBottom: '16px', textAlign: 'center' }}>
            <strong>Error:</strong> {error.message || 'Something went wrong.'}
          </div>
        )}

        <div style={{ padding: '20px', borderTop: '1px solid var(--card-border)', background: 'rgba(0,0,0,0.2)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px' }}>
            <input
              className="form-input"
              style={{ flex: 1, padding: '16px', fontSize: '1.05rem', borderRadius: '12px' }}
              value={input}
              placeholder="Where do you want to fly?"
              onChange={handleInputChange}
            />
            <button 
              type="submit" 
              className="btn btn-primary"
              style={{ padding: '0 32px', borderRadius: '12px', fontSize: '1.05rem', boxShadow: '0 0 15px rgba(59, 130, 246, 0.4)' }}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
