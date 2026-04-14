import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export default async function ConversationsPage() {
  let conversations: any[] = [];
  try {
    conversations = await db.conversation.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 10,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 3
        }
      }
    });
  } catch (error) {
    console.warn("DB not ready");
  }

  return (
    <div className="container" style={{ maxWidth: '900px' }}>
      <div className="flex justify-between items-center mb-6">
        <h2 style={{ fontSize: '2rem' }}>Recent Conversations</h2>
      </div>

      <div className="grid gap-4">
        {conversations.length === 0 ? (
          <div className="glass-panel text-center text-muted">
            No active conversations yet.
          </div>
        ) : (
          conversations.map(conv => (
            <div key={conv.id} className="glass-panel text-left">
              <div className="flex justify-between items-center mb-4 border-bottom">
                <div>
                  <h4 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>Phone: {conv.phoneNumber}</h4>
                  <span style={{ fontSize: '0.85rem', color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                    State: {conv.state}
                  </span>
                </div>
                <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                  Last updated: {new Date(conv.updatedAt).toLocaleString()}
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', marginTop: '16px' }}>
                <h5 style={{ marginBottom: '12px', color: '#94a3b8' }}>Latest Messages</h5>
                {conv.messages.length === 0 ? (
                  <p className="text-muted" style={{ fontSize: '0.85rem' }}>No messages logged.</p>
                ) : (
                  [...conv.messages].reverse().map((msg: any) => (
                    <div key={msg.id} style={{ marginBottom: '8px', display: 'flex', justifyContent: msg.direction === 'OUTBOUND' ? 'flex-end' : 'flex-start' }}>
                      <div style={{ 
                        maxWidth: '70%', 
                        padding: '8px 12px', 
                        borderRadius: '8px',
                        background: msg.direction === 'OUTBOUND' ? 'var(--primary)' : 'var(--card-bg)',
                        border: msg.direction === 'INBOUND' ? '1px solid var(--card-border)' : 'none',
                        color: 'white',
                        fontSize: '0.9rem'
                      }}>
                        <div style={{ fontSize: '0.7rem', opacity: 0.7, marginBottom: '4px' }}>
                          {msg.direction === 'OUTBOUND' ? 'Agent' : 'User'}
                        </div>
                        {msg.body}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
