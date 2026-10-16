'use client';
import {useEffect, useState} from 'react';

export default function AcceptView() {
  const [csrf, setCsrf] = useState('');
  const [message, setMessage] = useState('Loading invitation...');

  useEffect(() => {
    const token = new URLSearchParams(location.hash.replace(/^#/, '')).get('token');
    history.replaceState(null, '', location.pathname);
    const save = token
      ? fetch('/api/invitations/pending', {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify({token}),
        })
      : Promise.resolve(null);

    save
      .then((r) => {
        if (r && !r.ok) throw new Error('Invalid link');
        return fetch('/api/session', {cache: 'no-store'});
      })
      .then((r) => r.json())
      .then((s) => {
        if (s.authenticated) {
          setCsrf(s.csrf);
          setMessage('Ready to accept invitation');
        } else {
          setMessage('Sign in using the invited verified email address');
        }
      })
      .catch(() => setMessage('Invalid or unavailable invitation'));
  }, []);

  async function accept() {
    const r = await fetch('/api/invitations/accept', {
      method: 'POST',
      headers: {'x-csrf-token': csrf},
    });
    setMessage(
      r.ok
        ? 'Invitation accepted. Open the dashboard.'
        : 'Invitation expired, mismatched or service unavailable.'
    );
  }

  return (
    <main className="glass-card" style={{maxWidth: 520, margin: '80px auto', textAlign: 'center'}}>
      <div style={{marginBottom: 20}}>
        <span style={{fontSize: '2.5rem', filter: 'drop-shadow(0 0 12px rgba(99, 102, 241, 0.5))'}}>✉️</span>
      </div>
      <h1 className="card-title">Accept invitation</h1>
      <div className="status-pill" role="status" style={{margin: '16px auto 24px', display: 'inline-flex'}}>
        {message}
      </div>

      <div style={{marginTop: 20}}>
        {csrf ? (
          <button onClick={accept} className="btn btn-primary">
            Accept
          </button>
        ) : (
          <a
            href="/api/auth/login?returnTo=/accept-invite"
            className="btn btn-primary"
            style={{display: 'block'}}
          >
            Sign in
          </a>
        )}
      </div>

      <div style={{marginTop: 24}}>
        <a href="/dashboard" className="btn btn-outline" style={{display: 'inline-block'}}>
          Dashboard
        </a>
      </div>
    </main>
  );
}
