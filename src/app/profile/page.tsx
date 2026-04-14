import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  if (!id) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#ccc' }}>
        <h1>Profile</h1>
        <p>Missing user ID. Use the link your bot sent you.</p>
      </div>
    )
  }

  const user = await prisma.user.findFirst({
    where: { telegramChatId: id },
    include: { preferences: true },
  })

  if (!user) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#ccc' }}>
        <h1>Profile</h1>
        <p>User not found. Send a message to the bot first.</p>
      </div>
    )
  }

  async function updateProfile(formData: FormData) {
    'use server'

    const name = formData.get('name') as string
    const preferredAirlines = formData.get('preferredAirlines') as string
    const seatPreference = (formData.get('seatPreference') as string) || null
    const nonstopOnly = formData.get('nonstopOnly') === 'on'
    const maxPriceStr = formData.get('maxPrice') as string
    const maxPrice = maxPriceStr ? parseFloat(maxPriceStr) : null

    const targetUser = await prisma.user.findFirst({
      where: { telegramChatId: id },
    })
    if (!targetUser) return

    await prisma.user.update({
      where: { id: targetUser.id },
      data: { name: name || null },
    })

    await prisma.preference.upsert({
      where: { userId: targetUser.id },
      create: {
        userId: targetUser.id,
        preferredAirlines: preferredAirlines || '',
        seatPreference,
        nonstopOnly,
        maxPrice,
      },
      update: {
        preferredAirlines: preferredAirlines || '',
        seatPreference,
        nonstopOnly,
        maxPrice,
      },
    })

    revalidatePath(`/profile?id=${id}`)
    redirect(`/profile?id=${id}`)
  }

  const pref = user.preferences

  return (
    <div style={{ maxWidth: 480, margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ color: '#fff', marginBottom: '0.5rem' }}>Your Profile</h1>
      <p style={{ color: '#999', marginBottom: '1.5rem' }}>
        Edit your preferences. The bot will use these as defaults.
      </p>

      <form action={updateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label style={{ color: '#ccc' }}>
          Name
          <input
            name="name"
            defaultValue={user.name ?? ''}
            style={inputStyle}
          />
        </label>

        <label style={{ color: '#ccc' }}>
          Preferred Airlines (e.g. Delta, United)
          <input
            name="preferredAirlines"
            defaultValue={pref?.preferredAirlines ?? ''}
            style={inputStyle}
          />
        </label>

        <label style={{ color: '#ccc' }}>
          Seat Preference
          <select name="seatPreference" defaultValue={pref?.seatPreference ?? ''} style={inputStyle}>
            <option value="">No preference</option>
            <option value="window">Window</option>
            <option value="aisle">Aisle</option>
          </select>
        </label>

        <label style={{ color: '#ccc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            name="nonstopOnly"
            defaultChecked={pref?.nonstopOnly ?? false}
          />
          Nonstop flights only
        </label>

        <label style={{ color: '#ccc' }}>
          Max Price ($)
          <input
            name="maxPrice"
            type="number"
            defaultValue={pref?.maxPrice ?? ''}
            placeholder="No limit"
            style={inputStyle}
          />
        </label>

        <button
          type="submit"
          style={{
            padding: '0.75rem',
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: '1rem',
            cursor: 'pointer',
            marginTop: '0.5rem',
          }}
        >
          Save
        </button>
      </form>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.5rem',
  marginTop: '0.25rem',
  background: '#1a1a2e',
  border: '1px solid #333',
  borderRadius: 6,
  color: '#fff',
  fontSize: '1rem',
}
