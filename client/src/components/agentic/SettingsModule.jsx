import { useState, useEffect } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const TABS = [
  { key: 'company', label: 'Company Info' },
  { key: 'team',    label: 'Team Management' },
  { key: 'account', label: 'My Account' },
];

// ── Company Info Tab ──────────────────────────────────────────────────────────
function CompanyTab({ authFetch }) {
  const [company,  setCompany]  = useState(null);
  const [form,     setForm]     = useState({});
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    authFetch(`${BACKEND_URL}/settings/company`)
      .then(r => r.json())
      .then(d => {
        if (d.company) {
          setCompany(d.company);
          setForm({
            name:          d.company.name          || '',
            industry:      d.company.industry      || '',
            website:       d.company.website       || '',
            address:       d.company.address       || '',
            contact_email: d.company.contact_email || '',
            logo_url:      d.company.logo_url      || '',
          });
        }
      })
      .catch(() => setError('Failed to load company info.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      const res = await authFetch(`${BACKEND_URL}/settings/company`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Save failed.'); return; }
      setCompany(d.company);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { setError('Save failed.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="sett-loading">Loading…</div>;

  return (
    <div className="sett-section">
      <div className="sett-section-title">Company Information</div>
      {error && <div className="sett-error">{error}</div>}

      <div className="sett-form-grid">
        <label className="sett-label">
          Company Name <span className="sett-req">*</span>
          <input
            className="sett-input"
            value={form.name || ''}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Zeople AI"
          />
        </label>
        <label className="sett-label">
          Industry
          <input
            className="sett-input"
            value={form.industry || ''}
            onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
            placeholder="Recruitment Technology"
          />
        </label>
        <label className="sett-label">
          Website
          <input
            className="sett-input"
            value={form.website || ''}
            onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
            placeholder="https://zeople.ai"
          />
        </label>
        <label className="sett-label">
          Contact Email
          <input
            className="sett-input"
            type="email"
            value={form.contact_email || ''}
            onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
            placeholder="hello@yourcompany.com"
          />
        </label>
        <label className="sett-label sett-label--full">
          Address
          <input
            className="sett-input"
            value={form.address || ''}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            placeholder="123 Business Park, City, Country"
          />
        </label>
        <label className="sett-label sett-label--full">
          Logo URL
          <input
            className="sett-input"
            value={form.logo_url || ''}
            onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))}
            placeholder="https://..."
          />
        </label>
      </div>

      <div className="sett-footer">
        <button className="ag-btn ag-btn--primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ── Team Management Tab ───────────────────────────────────────────────────────
function TeamTab({ authFetch }) {
  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [form,     setForm]     = useState({ email: '', display_name: '', password: '', role: 'admin' });
  const [saving,   setSaving]   = useState(false);
  const [formErr,  setFormErr]  = useState('');

  const fetchMembers = () => {
    setLoading(true);
    authFetch(`${BACKEND_URL}/settings/team`)
      .then(r => r.json())
      .then(d => setMembers(d.members || []))
      .catch(() => setError('Failed to load team.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchMembers(); }, []);

  const openCreate = () => {
    setEditId(null);
    setForm({ email: '', display_name: '', password: '', role: 'admin' });
    setFormErr('');
    setShowForm(true);
  };

  const openEdit = (m) => {
    setEditId(m.id);
    setForm({ email: m.email, display_name: m.display_name || '', password: '', role: m.role });
    setFormErr('');
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setFormErr('');
    if (!form.display_name.trim()) { setFormErr('Display name is required.'); return; }
    if (!editId && (!form.email.trim() || !form.password)) {
      setFormErr('Email and password are required for new accounts.'); return;
    }
    setSaving(true);
    try {
      const url    = editId ? `${BACKEND_URL}/settings/team/${editId}` : `${BACKEND_URL}/settings/team`;
      const method = editId ? 'PUT' : 'POST';
      const body   = editId
        ? { display_name: form.display_name, email: form.email, role: form.role, ...(form.password ? { password: form.password } : {}) }
        : { email: form.email, display_name: form.display_name, password: form.password, role: form.role };

      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) { setFormErr(d.error || 'Failed.'); return; }
      setShowForm(false);
      fetchMembers();
    } catch { setFormErr('Request failed.'); }
    finally { setSaving(false); }
  };

  const handleToggleActive = async (m) => {
    await authFetch(`${BACKEND_URL}/settings/team/${m.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: m.is_active ? 0 : 1 }),
    });
    fetchMembers();
  };

  const ROLE_LABELS = { admin: 'Recruiter (Admin)', subuser: 'Recruiter (Sub-user)' };

  return (
    <div className="sett-section">
      <div className="sett-section-header">
        <div className="sett-section-title">Team Members</div>
        <button className="ag-btn ag-btn--primary ag-btn--sm" onClick={openCreate}>+ Add Member</button>
      </div>
      {error && <div className="sett-error">{error}</div>}

      {loading ? (
        <div className="sett-loading">Loading…</div>
      ) : members.length === 0 ? (
        <div className="sett-empty">No team members yet. Add your first recruiter to get started.</div>
      ) : (
        <div className="sett-team-list">
          {members.map(m => (
            <div key={m.id} className={`sett-team-row${m.is_active ? '' : ' sett-team-row--inactive'}`}>
              <div className="sett-team-avatar">{(m.display_name || m.email)[0].toUpperCase()}</div>
              <div className="sett-team-info">
                <div className="sett-team-name">{m.display_name || '(no name)'}</div>
                <div className="sett-team-meta">
                  <span>{m.email}</span>
                  <span className="sett-role-badge">{ROLE_LABELS[m.role] || m.role}</span>
                  {!m.is_active && <span className="sett-inactive-badge">Inactive</span>}
                </div>
              </div>
              <div className="sett-team-actions">
                <button className="ag-btn ag-btn--ghost ag-btn--sm" onClick={() => openEdit(m)}>Edit</button>
                <button
                  className={`ag-btn ag-btn--sm ${m.is_active ? 'ag-btn--ghost' : 'ag-btn--primary'}`}
                  onClick={() => handleToggleActive(m)}
                >
                  {m.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="ag-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="ag-modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="ag-modal-header">
              <h3 className="ag-modal-title">{editId ? 'Edit Team Member' : 'Add Team Member'}</h3>
              <button className="ag-modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="ag-modal-body">
              {formErr && <div className="sett-error">{formErr}</div>}
              <div className="sett-form-stack">
                <label className="sett-label">
                  Full Name
                  <input
                    className="sett-input"
                    value={form.display_name}
                    onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                    placeholder="Jane Recruiter"
                  />
                </label>
                <label className="sett-label">
                  Email
                  <input
                    className="sett-input"
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="jane@yourcompany.com"
                  />
                </label>
                <label className="sett-label">
                  {editId ? 'New Password (leave blank to keep)' : 'Password'}
                  <input
                    className="sett-input"
                    type="password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder={editId ? 'Leave blank to keep current' : 'Min 6 characters'}
                  />
                </label>
                <label className="sett-label">
                  Role
                  <select
                    className="sett-input"
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  >
                    <option value="admin">Recruiter (Admin)</option>
                    <option value="subuser">Recruiter (Sub-user)</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="ag-modal-footer">
              <button className="ag-btn ag-btn--ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="ag-btn ag-btn--primary" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Account Tab ───────────────────────────────────────────────────────────────
function AccountTab({ authFetch }) {
  const [form,    setForm]    = useState({ display_name: '', password: '', confirmPassword: '' });
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState('');

  const handleSave = async () => {
    setError(''); setSaved(false);
    if (form.password && form.password !== form.confirmPassword) {
      setError('Passwords do not match.'); return;
    }
    const body = {};
    if (form.display_name.trim()) body.display_name = form.display_name.trim();
    if (form.password)            body.password      = form.password;
    if (Object.keys(body).length === 0) { setError('Nothing to update.'); return; }

    setSaving(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/settings/account`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Save failed.'); return; }
      setSaved(true);
      setForm(f => ({ ...f, password: '', confirmPassword: '' }));
      setTimeout(() => setSaved(false), 2500);
    } catch { setError('Save failed.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="sett-section">
      <div className="sett-section-title">My Account</div>
      {error && <div className="sett-error">{error}</div>}

      <div className="sett-form-stack" style={{ maxWidth: 420 }}>
        <label className="sett-label">
          Display Name
          <input
            className="sett-input"
            value={form.display_name}
            onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
            placeholder="Your name"
          />
        </label>
        <div className="sett-divider" />
        <div className="sett-section-subtitle">Change Password</div>
        <label className="sett-label">
          New Password
          <input
            className="sett-input"
            type="password"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            placeholder="Min 6 characters"
          />
        </label>
        <label className="sett-label">
          Confirm Password
          <input
            className="sett-input"
            type="password"
            value={form.confirmPassword}
            onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
            placeholder="Re-enter new password"
          />
        </label>
      </div>

      <div className="sett-footer">
        <button className="ag-btn ag-btn--primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ── Main SettingsModule ───────────────────────────────────────────────────────
export default function SettingsModule({ authFetch }) {
  const [activeTab, setActiveTab] = useState('company');

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>

      <div className="sett-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`sett-tab-btn${activeTab === t.key ? ' sett-tab-btn--active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="sett-content">
        {activeTab === 'company' && <CompanyTab authFetch={authFetch} />}
        {activeTab === 'team'    && <TeamTab    authFetch={authFetch} />}
        {activeTab === 'account' && <AccountTab authFetch={authFetch} />}
      </div>
    </div>
  );
}
