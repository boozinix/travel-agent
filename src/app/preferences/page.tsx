export default async function PreferencesPage() {
  return (
    <div className="container" style={{ maxWidth: '800px' }}>
      <div className="flex justify-between items-center mb-6">
        <h2 style={{ fontSize: '2rem' }}>Travel Preferences</h2>
      </div>

      <div className="glass-panel text-left">
        <h3 className="mb-6">Global Search Settings</h3>
        <form>
          <div className="form-group">
            <label className="form-label">Preferred Airlines (comma separated, IATA)</label>
            <input type="text" name="preferredAirlines" className="form-input" placeholder="DL, AA, UA" defaultValue="DL, AA, AS" />
          </div>

          <div className="form-group grid grid-cols-2">
            <div>
              <label className="form-label">Max Price ($)</label>
              <input type="number" name="maxPrice" className="form-input" placeholder="500" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', paddingTop: '28px' }}>
              <label className="form-label flex items-center gap-4" style={{ marginBottom: 0, cursor: 'pointer' }}>
                <input type="checkbox" name="nonstopOnly" defaultChecked style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }} />
                Non-stop flights only
              </label>
            </div>
          </div>

          <div className="form-group grid grid-cols-2">
            <div>
              <label className="form-label">Earliest Departure</label>
              <input type="time" name="earliestDepTime" className="form-input" defaultValue="06:00" />
            </div>
            <div>
              <label className="form-label">Latest Departure</label>
              <input type="time" name="latestDepTime" className="form-input" defaultValue="22:00" />
            </div>
          </div>

          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '20px' }}>Note: In this v1 demo, preferences will not actively filter the Tequila search unless implemented in flightSearch.ts.</p>
          
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            Save Preferences
          </button>
        </form>
      </div>
    </div>
  );
}
