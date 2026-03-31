import { prisma } from '@/lib/db'
import styles from './conversations.module.css'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ConversationsPage() {
  let conversations: Awaited<ReturnType<typeof loadConversations>> = []
  let dbError: string | null = null

  try {
    conversations = await loadConversations()
  } catch (err: unknown) {
    dbError = err instanceof Error ? err.message : 'DB error'
  }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <h1 className={styles.title}>Conversations</h1>
        <Link href="/" className={styles.backLink}>Dashboard</Link>
      </div>

      {dbError ? (
        <p className={styles.error}>Database error: {dbError}</p>
      ) : conversations.length === 0 ? (
        <p className={styles.empty}>
          No conversations yet. Use the <Link href="/simulate">simulator</Link> or text the bot to start one.
        </p>
      ) : (
        <div className={styles.list}>
          {conversations.map((conv) => (
            <details key={conv.id} className={styles.convCard}>
              <summary className={styles.summary}>
                <span className={styles.phone}>{conv.phoneNumber}</span>
                <span className={styles.state}>{conv.state}</span>
                <span className={styles.date}>{new Date(conv.updatedAt).toLocaleString()}</span>
                <span className={styles.count}>{conv.messages.length} msgs</span>
              </summary>
              <div className={styles.thread}>
                {conv.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={msg.direction === 'INBOUND' ? styles.inbound : styles.outbound}
                  >
                    <span className={styles.dir}>{msg.direction === 'INBOUND' ? 'User' : 'Bot'}</span>
                    <div className={styles.body}>{msg.body}</div>
                    <span className={styles.ts}>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                  </div>
                ))}
                {conv.pendingOffers.length > 0 && (
                  <div className={styles.offersSection}>
                    <span className={styles.dir}>Offers shown</span>
                    {conv.pendingOffers.map((o) => (
                      <div key={o.id} className={styles.offer}>
                        {o.offerIndex}. {o.airline} ${o.priceAmount} — {o.originAirport}→{o.destinationAirport} {o.departureDate}
                        {o.bookingLink && (
                          <a href={o.bookingLink} target="_blank" rel="noopener noreferrer" className={styles.link}> Book</a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}

async function loadConversations() {
  return prisma.conversation.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 50,
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      pendingOffers: { orderBy: { offerIndex: 'asc' } },
    },
  })
}
