export default function ErrorPage() {
  return (
    <main className="glass-card" style={{maxWidth: 520, margin: '80px auto', textAlign: 'center'}}>
      <div style={{marginBottom: 20}}>
        <span style={{fontSize: '2.5rem', filter: 'drop-shadow(0 0 12px rgba(239, 68, 68, 0.5))'}}>⚠️</span>
      </div>
      <h1 className="card-title" style={{color: '#f87171'}}>Sign-in failed</h1>
      <p className="card-subtitle" style={{marginTop: 8}}>
        Return to the dashboard and try again. No authorization changes were made.
      </p>
      <div style={{marginTop: 28}}>
        <a href="/dashboard" className="btn btn-outline" style={{display: 'inline-block'}}>
          Dashboard
        </a>
      </div>
    </main>
  );
}
