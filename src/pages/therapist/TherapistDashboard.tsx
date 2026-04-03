const TherapistDashboard = () => (
  <div>
    <h1 className="font-display text-3xl text-foreground mb-2">Therapist Dashboard</h1>
    <p className="font-body text-muted-foreground mb-10">Here's your day at a glance.</p>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {[
        { label: 'Today\'s Sessions', value: '0' },
        { label: 'This Week', value: '0' },
        { label: 'Unread Messages', value: '0' },
        { label: 'Earnings (Month)', value: 'KES 0' },
      ].map((s) => (
        <div key={s.label} className="bg-card rounded-card p-6 shadow-card border border-border">
          <p className="font-ui text-sm text-muted-foreground">{s.label}</p>
          <p className="font-display text-2xl text-foreground mt-1">{s.value}</p>
        </div>
      ))}
    </div>
  </div>
);

export default TherapistDashboard;
