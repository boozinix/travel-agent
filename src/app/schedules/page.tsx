import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// Server action to add schedule
async function addSchedule(formData: FormData) {
  "use server"
  try {
    // 1. Get or create a default user (since auth isn't fully set up yet)
    // You would replace this with real auth session retrieval
    let user = await db.user.findFirst();
    if (!user) {
      user = await db.user.create({
        data: { phoneNumber: process.env.TWILIO_PHONE_NUMBER || "+1555555555" }
      });
    }

    const origin = formData.get("originAirport") as string;
    const dest = formData.get("destinationAirport") as string;
    const targetDates = formData.get("targetDates") as string;
    const time = formData.get("notificationTime") as string;
    const day = formData.get("notificationDay") as string;

    await db.schedule.create({
      data: {
        userId: user.id,
        originAirport: origin.toUpperCase(),
        destinationAirport: dest.toUpperCase(),
        targetDates: targetDates,
        notificationTime: time,
        notificationDay: day.toUpperCase(),
        directionLabel: `${origin.toUpperCase()} to ${dest.toUpperCase()} check on ${day}`,
        active: true,
      }
    });

    revalidatePath("/schedules");
  } catch (error) {
    console.error("Failed to add schedule", error);
  }
}

async function deleteSchedule(formData: FormData) {
  "use server"
  try {
    const id = formData.get("id") as string;
    await db.schedule.delete({ where: { id } });
    revalidatePath("/schedules");
  } catch (err) {
    console.error("Failed", err);
  }
}

export default async function SchedulesPage() {
  let schedules: any[] = [];
  try {
    schedules = await db.schedule.findMany();
  } catch (error) {
    console.warn("Database likely not configured yet.");
  }

  return (
    <div className="container">
      <div className="flex justify-between items-center mb-6">
        <h2 style={{ fontSize: '2rem' }}>Your Schedules</h2>
      </div>

      <div className="grid grid-cols-2" style={{ gridTemplateColumns: 'minmax(300px, 2fr) minmax(300px, 1fr)' }}>
        <div className="glass-panel text-left">
          <h3 className="mb-6">Active Routes</h3>
          {schedules.length === 0 ? (
            <p className="text-muted">No schedules found. Configure one now!</p>
          ) : (
            <div className="grid" style={{ gap: '16px' }}>
              {schedules.map(sch => (
                <div key={sch.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                  <div className="flex justify-between items-center">
                    <h4 style={{ fontSize: '1.2rem'}}>{sch.originAirport} &rarr; {sch.destinationAirport}</h4>
                    <span style={{ fontSize: '0.8rem', background: sch.active ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: sch.active ? 'var(--success)' : 'var(--danger)', padding: '4px 8px', borderRadius: '12px' }}>
                      {sch.active ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <p className="text-muted mt-2" style={{ fontSize: '0.9rem'}}>
                    Checks on <strong>{sch.notificationDay}s</strong> at <strong>{sch.notificationTime}</strong>
                  </p>
                  <p className="text-muted" style={{ fontSize: '0.9rem'}}>
                    Target Dates: {sch.targetDates}
                  </p>
                  <form action={deleteSchedule} style={{ marginTop: '12px', textAlign: 'right' }}>
                    <input type="hidden" name="id" value={sch.id} />
                    <button type="submit" className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>Remove</button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-panel text-left">
          <h3 className="mb-6">Add New Schedule</h3>
          <form action={addSchedule}>
            <div className="form-group flex justify-between gap-4">
              <div style={{ flex: 1 }}>
                <label className="form-label">Origin (IATA)</label>
                <input required type="text" name="originAirport" className="form-input" placeholder="NYC" maxLength={3} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">Destination (IATA)</label>
                <input required type="text" name="destinationAirport" className="form-input" placeholder="SFO" maxLength={3} />
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">Target Dates (comma separated)</label>
              <input required type="text" name="targetDates" className="form-input" placeholder="2024-04-23, 2024-04-30" />
            </div>

            <div className="form-group grid grid-cols-2">
              <div>
                <label className="form-label">Notification Day</label>
                <select name="notificationDay" className="form-input" style={{ appearance: 'none' }}>
                  <option value="MONDAY">Monday</option>
                  <option value="TUESDAY">Tuesday</option>
                  <option value="WEDNESDAY">Wednesday</option>
                  <option value="THURSDAY">Thursday</option>
                  <option value="FRIDAY">Friday</option>
                  <option value="SATURDAY">Saturday</option>
                  <option value="SUNDAY">Sunday</option>
                </select>
              </div>
              <div>
                <label className="form-label">Notification Time (Local)</label>
                <input required type="time" name="notificationTime" className="form-input" defaultValue="18:00" />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
              Create Schedule
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
