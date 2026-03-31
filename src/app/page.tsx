import { prisma } from '@/lib/db'
import Link from 'next/link'
import {
  createSchedule,
  deleteSchedule,
  setScheduleActive,
  upsertPreferences,
  upsertUser,
} from '@/app/actions'
import { getIntegrationStatus } from '@/lib/integrations'
import { APP_DEV_PORT } from '@/lib/constants'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

async function loadDashboardUsers() {
  return prisma.user.findMany({
    include: {
      schedules: { orderBy: { directionLabel: 'asc' } },
      preferences: true,
      conversations: {
        orderBy: { updatedAt: 'desc' },
        take: 3,
        include: { pendingOffers: true, messages: true },
      },
    },
    orderBy: { phoneNumber: 'asc' },
  })
}

export default async function Dashboard() {
  const integration = getIntegrationStatus()

  let users: Awaited<ReturnType<typeof loadDashboardUsers>> = []
  let dbError: string | null = null
  try {
    users = await loadDashboardUsers()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database connection failed'
    dbError = msg
    console.error('[dashboard] database unavailable:', err)
  }

  const dbOk = dbError === null

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <h1 className={styles.title}>Flight SMS Assistant</h1>
        <p className={styles.subtitle}>
          Local app runs on port {APP_DEV_PORT}. Configure routes, alert times, and SMS. Hourly cron on
          Vercel; schedules use the server&apos;s local day and hour unless you set TZ.
        </p>
        <nav className={styles.nav}>
          <Link href="/simulate">SMS Simulator</Link>
          <Link href="/conversations">Conversations</Link>
          <Link href="/api/test-search?from=NYC&to=SFO&date=2026-05-01">Test Flight Search</Link>
          <Link href="/api/health">Health</Link>
        </nav>
      </header>

      {dbError ? (
        <div className={styles.dbErrorBanner}>
          <strong>Database not reachable</strong>
          Prisma tried to use <code>DATABASE_URL</code> from your <code>.env</code> and could not connect.
          <br />
          <br />
          If the error mentions <code>:6543</code> on <code>db.*</code>, your network is blocking the
          transaction pooler port. Switch both <code>DATABASE_URL</code> and{' '}
          <code>DIRECT_URL</code> to the <strong>Session pooler</strong> URI from Supabase → Connect
          (host like <code>aws-0-…pooler.supabase.com:5432</code>, user{' '}
          <code>postgres.your-project-ref</code>). Paste the same line twice. Wrong region in the
          hostname causes <strong>Tenant or user not found</strong>. Or use a phone hotspot and the
          transaction pooler URLs. Restart <code>npm run dev</code> after saving <code>.env</code>.
          <br />
          <br />
          <span style={{ opacity: 0.85 }}>Technical detail: {dbError}</span>
          <br />
          <br />
          Until this is fixed, Save buttons below will fail because they also need Postgres.
        </div>
      ) : null}

      <div className={styles.grid}>
        <section className={`${styles.card} ${styles.gridFull}`}>
          <h2 className={styles.cardTitle}>Integration status</h2>
          <ul className={styles.statusList}>
            <li className={styles.statusRow}>
              <span className={integration.database ? styles.statusOk : styles.statusBad}>
                {integration.database ? '●' : '○'}
              </span>
              Database (Supabase Postgres)
            </li>
            <li className={styles.statusRow}>
              <span className={integration.ignav ? styles.statusOk : styles.statusBad}>
                {integration.ignav ? '●' : '○'}
              </span>
              Ignav flight API key
            </li>
            <li className={styles.statusRow}>
              <span className={integration.whatsapp ? styles.statusOk : styles.statusBad}>
                {integration.whatsapp ? '●' : '○'}
              </span>
              WhatsApp Cloud API (free, recommended)
            </li>
            <li className={styles.statusRow}>
              <span className={integration.twilio ? styles.statusOk : styles.statusBad}>
                {integration.twilio ? '●' : '○'}
              </span>
              Twilio SMS (optional alternative)
            </li>
            <li className={styles.statusRow}>
              <span className={integration.cronSecret ? styles.statusOk : styles.statusBad}>
                {integration.cronSecret ? '●' : '○'}
              </span>
              CRON_SECRET (optional locally; use on Vercel)
            </li>
          </ul>
          <p className={styles.hint}>
            <strong>WhatsApp webhook</strong> (POST): paste in Meta App Dashboard → WhatsApp →
            Configuration → Callback URL. Set <code>WHATSAPP_VERIFY_TOKEN</code> to match.
          </p>
          <pre className={styles.codeBlock}>{integration.whatsappWebhookUrl}</pre>
          <p className={styles.hint}>
            <strong>Twilio SMS webhook</strong> (POST, optional): paste in Twilio Console if using SMS.
          </p>
          <pre className={styles.codeBlock}>{integration.smsWebhookUrl}</pre>
          <p className={styles.hint}>
            Health JSON: <code>/api/health</code>
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Register phone</h2>
          <form className={styles.form} action={upsertUser}>
            <label className={styles.label}>
              <span>E.164 number (Twilio)</span>
              <input
                className={styles.input}
                name="phone"
                type="tel"
                placeholder="+15551234567"
                required
                autoComplete="tel"
              />
            </label>
            <button type="submit" className={styles.btnPrimary}>
              Save user
            </button>
          </form>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>New schedule alert</h2>
          <form className={styles.form} action={createSchedule}>
            <label className={styles.label}>
              <span>User</span>
              <select className={styles.select} name="userId" required defaultValue="">
                <option value="" disabled>
                  Select user
                </option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.phoneNumber}
                  </option>
                ))}
              </select>
            </label>
            <div className={`${styles.row} ${styles.row2}`}>
              <label className={styles.label}>
                <span>Origin (IATA / city)</span>
                <input className={styles.input} name="originAirport" placeholder="NYC" required />
              </label>
              <label className={styles.label}>
                <span>Destination</span>
                <input className={styles.input} name="destinationAirport" placeholder="LAX" required />
              </label>
            </div>
            <label className={styles.label}>
              <span>Target dates (comma-separated)</span>
              <input
                className={styles.input}
                name="targetDates"
                placeholder="2026-04-23,2026-04-30"
                required
              />
            </label>
            <div className={`${styles.row} ${styles.row2}`}>
              <label className={styles.label}>
                <span>Notification day</span>
                <select className={styles.select} name="notificationDay" required defaultValue="THURSDAY">
                  {['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].map(
                    (d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    )
                  )}
                </select>
              </label>
              <label className={styles.label}>
                <span>Local time</span>
                <input className={styles.input} name="notificationTime" type="time" required defaultValue="18:00" />
              </label>
            </div>
            <label className={styles.label}>
              <span>Label (optional)</span>
              <input className={styles.input} name="directionLabel" placeholder="NYC→LAX spring trip" />
            </label>
            <button type="submit" className={styles.btnPrimary}>
              Add schedule
            </button>
          </form>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Search preferences</h2>
          <form className={styles.form} action={upsertPreferences}>
            <label className={styles.label}>
              <span>User</span>
              <select className={styles.select} name="userId" required defaultValue="">
                <option value="" disabled>
                  Select user
                </option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.phoneNumber}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.label}>
              <span>Preferred airlines (comma-separated or &quot;any&quot;)</span>
              <input className={styles.input} name="preferredAirlines" placeholder="UA,AA" />
            </label>
            <div className={`${styles.row} ${styles.row2}`}>
              <label className={styles.label}>
                <span>Max price (USD)</span>
                <input className={styles.input} name="maxPrice" type="number" step="1" min="0" placeholder="800" />
              </label>
              <label className={`${styles.label} ${styles.checkbox}`}>
                <input name="nonstopOnly" type="checkbox" />
                Nonstop only
              </label>
            </div>
            <div className={`${styles.row} ${styles.row2}`}>
              <label className={styles.label}>
                <span>Earliest dep.</span>
                <input className={styles.input} name="earliestDepTime" type="time" />
              </label>
              <label className={styles.label}>
                <span>Latest dep.</span>
                <input className={styles.input} name="latestDepTime" type="time" />
              </label>
            </div>
            <button type="submit" className={styles.btnPrimary}>
              Save preferences
            </button>
          </form>
        </section>
      </div>

      <section className={styles.usersSection}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Users & activity</h2>
          <span className={styles.badge}>{users.length} registered</span>
        </div>

        {users.length === 0 ? (
          <p className={styles.empty}>No users yet — add a phone above, or text your Twilio number to register.</p>
        ) : (
          users.map((user) => (
            <article key={user.id} className={styles.userCard}>
              <div className={styles.userHeader}>
                <span className={styles.phone}>{user.phoneNumber}</span>
              </div>

              <div className={styles.innerGrid}>
                <div>
                  <h3 className={styles.cardTitle}>Schedules</h3>
                  {user.schedules.length === 0 ? (
                    <p className={styles.empty}>No alerts.</p>
                  ) : (
                    <ul className={styles.scheduleList}>
                      {user.schedules.map((sched) => (
                        <li key={sched.id} className={styles.scheduleItem}>
                          <strong>{sched.directionLabel}</strong>
                          <div className={styles.scheduleMeta}>
                            {sched.originAirport} → {sched.destinationAirport} · {sched.targetDates}
                            <br />
                            {sched.notificationDay} @ {sched.notificationTime}
                            {sched.active ? ' · active' : ' · paused'}
                          </div>
                          <div className={styles.scheduleActions}>
                            <form action={setScheduleActive}>
                              <input type="hidden" name="id" value={sched.id} />
                              <input type="hidden" name="active" value={String(!sched.active)} />
                              <button type="submit" className={styles.btnGhost}>
                                {sched.active ? 'Pause' : 'Resume'}
                              </button>
                            </form>
                            <form action={deleteSchedule}>
                              <input type="hidden" name="id" value={sched.id} />
                              <button type="submit" className={styles.btnDanger}>
                                Delete
                              </button>
                            </form>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h3 className={styles.cardTitle}>Recent conversations</h3>
                  {user.conversations.length === 0 ? (
                    <p className={styles.empty}>No SMS threads yet.</p>
                  ) : (
                    user.conversations.map((conv) => (
                      <div key={conv.id} className={styles.chatBox}>
                        <div className={styles.chatState}>{conv.state}</div>
                        <div>{conv.context || '—'}</div>
                        <div className={styles.scheduleMeta}>
                          {conv.messages.length} messages · {new Date(conv.updatedAt).toLocaleString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  )
}
