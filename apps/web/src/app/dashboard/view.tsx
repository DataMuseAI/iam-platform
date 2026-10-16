'use client';
import {useEffect, useState} from 'react';

type Membership = {
  identity_id: string;
  tenant_id: string;
  is_owner: boolean;
  product_id: string;
};

type Role = {
  id: string;
  name: string;
  product_id: string;
};

const ShieldIcon = ({size = 24}: {size?: number}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: '#818cf8'}}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export default function Dashboard() {
  const [csrf, setCsrf] = useState('');
  const [members, setMembers] = useState<Membership[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [tenant, setTenant] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/session', {cache: 'no-store'})
      .then((r) => r.json())
      .then((s) => {
        if (s.authenticated) {
          setCsrf(s.csrf);
          fetch('/api/tenants', {cache: 'no-store'})
            .then((r) => r.json())
            .then((x) => setMembers(x.memberships ?? []));
        }
      })
      .catch(() => setMessage('Service unavailable'));
  }, []);

  useEffect(() => {
    if (!tenant) return;
    fetch(`/api/roles?tenant_id=${encodeURIComponent(tenant)}`, {cache: 'no-store'})
      .then((r) => r.json())
      .then((x) => setRoles(x.roles ?? []))
      .catch(() => setRoles([]));
  }, [tenant]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/invitations/create', {
      method: 'POST',
      headers: {'content-type': 'application/json', 'x-csrf-token': csrf},
      body: JSON.stringify({tenant_id: tenant, email, role_id: role}),
    });
    setMessage(r.ok ? 'Invitation queued' : 'Invitation denied or service unavailable');
  }

  async function logout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {'x-csrf-token': csrf},
    });
    location.href = '/dashboard';
  }

  // Unauthenticated State
  if (!csrf) {
    return (
      <main className="glass-card" style={{maxWidth: 480, margin: '80px auto', textAlign: 'center'}}>
        <div style={{marginBottom: 20}}>
          <ShieldIcon size={44} />
        </div>
        <h1 className="card-title">IAM dashboard</h1>
        <p className="card-subtitle">
          Secure, multi-tenant enterprise identity management. Sign in to access your organization.
        </p>
        <div style={{marginTop: 28}}>
          <a href="/api/auth/login" className="btn btn-primary" style={{display: 'block'}}>
            Sign in
          </a>
        </div>
        {message && <p className="status-pill" role="status" style={{marginTop: 20}}>{message}</p>}
      </main>
    );
  }

  const ownerTenants = [...new Map(members.filter((m) => m.is_owner).map((m) => [m.tenant_id, m])).values()];

  // Authenticated State
  return (
    <main>
      {/* Top Navbar */}
      <header className="app-header">
        <div className="brand-wrapper">
          <div className="brand-logo"><ShieldIcon size={20} /></div>
          <span className="brand-title">Enterprise IAM Platform</span>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
          <span className="header-status">
            <span className="status-dot"></span>
            Operational
          </span>
          <button onClick={logout} className="btn btn-outline">
            Sign out
          </button>
        </div>
      </header>

      {/* Main Container Card */}
      <section className="glass-card">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16}}>
          <div>
            <h1 className="card-title">IAM dashboard</h1>
            <p className="card-subtitle">
              Manage tenants, role delegations, and team member invitations.
            </p>
          </div>
        </div>

        {/* Stat Overview */}
        <div className="stat-grid">
          <div className="stat-item">
            <div className="stat-label">Active Memberships</div>
            <div className="stat-value">{members.length}</div>
            <p style={{fontSize: '0.8rem', color: '#94a3b8', marginTop: 4}}>
              Active tenant/product memberships: {members.length}
            </p>
          </div>
          <div className="stat-item">
            <div className="stat-label">Accessible Tenants</div>
            <div className="stat-value">{ownerTenants.length}</div>
            <p style={{fontSize: '0.8rem', color: '#94a3b8', marginTop: 4}}>
              Owned &amp; administered tenants
            </p>
          </div>
        </div>

        {/* Tenant Switcher */}
        <div className="form-group">
          <label className="form-label">
            Tenant{' '}
            <select
              className="form-select"
              value={tenant}
              onChange={(e) => {
                setTenant(e.target.value);
                setRole('');
              }}
            >
              <option value="">Choose</option>
              {ownerTenants.map((m) => (
                <option key={m.tenant_id} value={m.tenant_id}>
                  {m.tenant_id} (Owner)
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Member Invitation Card */}
        <div
          style={{
            marginTop: 32,
            padding: 24,
            background: 'rgba(15, 23, 42, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 16,
          }}
        >
          <h2 style={{fontSize: '1.15rem', fontWeight: 600, color: '#f8fafc', marginBottom: 16}}>
            Invite member
          </h2>

          <form onSubmit={invite}>
            <div className="form-group">
              <label className="form-label">
                Email{' '}
                <input
                  type="email"
                  required
                  placeholder="collaborator@company.com"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">
                Role{' '}
                <select
                  required
                  className="form-select"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={!tenant}
                >
                  <option value="">Choose</option>
                  {roles
                    .filter((r) => r.name !== 'owner')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.product_id})
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <button
              type="submit"
              disabled={!tenant || !role}
              className="btn btn-primary"
            >
              Send invitation
            </button>
          </form>

          {message && (
            <div className="status-pill" role="status" style={{marginTop: 16}}>
              <span>ℹ️</span> {message}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
