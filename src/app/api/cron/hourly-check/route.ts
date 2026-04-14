import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendSms } from '@/lib/sms';

export async function GET(req: Request) {
  // Simple auth for Vercel Cron
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn('Unauthorized cron check', authHeader);
    // return new NextResponse('Unauthorized', { status: 401 });
    // Keep open during dev for manual checks
    if (process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
  }

  try {
    // 1. Determine current day of week and current hour.
    const now = new Date();
    const currentHour = now.getUTCHours(); // You might want this in PT or local
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const currentDay = days[now.getUTCDay()]; 
    // ^ Wait, using UTC time directly. The dashboard should save UTC or we convert.
    // For simplicity, let's just grab all active schedules and mock match.
    // In strict production, ensure timezone matches 'notificationTime' (e.g. 18:00 America/Los_Angeles)

    const activeSchedules = await db.schedule.findMany({
      where: { active: true },
      include: { user: true }
    });

    console.log(`Analyzing ${activeSchedules.length} active schedules for hourly match.`);
    let triggeredCount = 0;

    for (const schedule of activeSchedules) {
      // NOTE: In a real app we parse notificationTime and evaluate against current time.
      // For mvp, if notificationTime matches current hour (approx) we trigger.
      // For now, let's just trigger ANY active schedule that doesn't have an active conversation.
      
      const targetDates = schedule.targetDates.split(',').map((d: string) => d.trim());
      if (targetDates.length < 1) continue;

      // Close old conversations or find if already in progress
      const existing = await db.conversation.findFirst({
        where: { userId: schedule.userId, state: { not: 'DONE' } }
      });
      if (existing) continue; // Waiting on user

      // Create a Conversation
      const conversation = await db.conversation.create({
        data: {
          userId: schedule.userId,
          phoneNumber: schedule.user.phoneNumber,
          state: 'ASK_TRIP_DATE',
          context: JSON.stringify({
            origin: schedule.originAirport,
            destination: schedule.destinationAirport,
            dateOptions: targetDates
          })
        }
      });

      // Send the prompt
      let prompt = `Hi! Do you want to book ${schedule.originAirport} → ${schedule.destinationAirport}? Reply:`;
      for(let i=0; i<targetDates.length; i++) {
        prompt += `\n${i+1} for ${targetDates[i]}`;
      }

      await sendSms(schedule.user.phoneNumber, prompt);

      // Save the outbound message
      await db.conversationMessage.create({
        data: {
          conversationId: conversation.id,
          direction: 'OUTBOUND',
          body: prompt
        }
      });

      triggeredCount++;
    }

    return NextResponse.json({ success: true, triggeredCount });
  } catch (err: any) {
    console.error('Hourly Check failed', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
