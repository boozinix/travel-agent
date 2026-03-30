'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

const DAYS = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const

export async function upsertUser(formData: FormData) {
  const phone = String(formData.get('phone') ?? '').trim()
  if (!phone) return

  await prisma.user.upsert({
    where: { phoneNumber: phone },
    create: { phoneNumber: phone },
    update: {},
  })
  revalidatePath('/')
}

export async function createSchedule(formData: FormData) {
  const userId = String(formData.get('userId') ?? '').trim()
  const originAirport = String(formData.get('originAirport') ?? '').trim().toUpperCase()
  const destinationAirport = String(formData.get('destinationAirport') ?? '').trim().toUpperCase()
  const targetDates = String(formData.get('targetDates') ?? '').trim()
  const notificationDay = String(formData.get('notificationDay') ?? '').trim().toUpperCase()
  const notificationTime = String(formData.get('notificationTime') ?? '').trim()
  const directionLabel = String(formData.get('directionLabel') ?? '').trim()

  if (!userId || !originAirport || !destinationAirport || !targetDates || !notificationDay || !notificationTime) {
    return
  }

  if (!DAYS.includes(notificationDay as (typeof DAYS)[number])) {
    return
  }

  await prisma.schedule.create({
    data: {
      userId,
      originAirport,
      destinationAirport,
      targetDates,
      notificationDay,
      notificationTime,
      directionLabel: directionLabel || `${originAirport}→${destinationAirport}`,
      active: true,
    },
  })
  revalidatePath('/')
}

export async function setScheduleActive(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const active = String(formData.get('active') ?? '') === 'true'
  if (!id) return
  await prisma.schedule.update({ where: { id }, data: { active } })
  revalidatePath('/')
}

export async function deleteSchedule(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await prisma.schedule.delete({ where: { id } })
  revalidatePath('/')
}

export async function upsertPreferences(formData: FormData) {
  const userId = String(formData.get('userId') ?? '').trim()
  if (!userId) return

  const preferredAirlines = String(formData.get('preferredAirlines') ?? '').trim() || 'any'
  const maxPriceRaw = String(formData.get('maxPrice') ?? '').trim()
  const maxPrice = maxPriceRaw ? parseFloat(maxPriceRaw) : null
  const nonstopOnly = String(formData.get('nonstopOnly') ?? '') === 'on'
  const earliestDepTime = String(formData.get('earliestDepTime') ?? '').trim() || null
  const latestDepTime = String(formData.get('latestDepTime') ?? '').trim() || null

  await prisma.preference.upsert({
    where: { userId },
    create: {
      userId,
      preferredAirlines,
      maxPrice: maxPrice ?? undefined,
      nonstopOnly,
      earliestDepTime,
      latestDepTime,
    },
    update: {
      preferredAirlines,
      maxPrice,
      nonstopOnly,
      earliestDepTime,
      latestDepTime,
    },
  })
  revalidatePath('/')
}
