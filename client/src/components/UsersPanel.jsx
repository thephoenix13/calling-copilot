import { useEffect, useState } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export default function UsersPanel({ authToken, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${BACKEND_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setUsers(data.users || []);
      })
      .catch(() => setError('Failed to load users.'))
      .finally(() => setLoading(false));
  }, [authToken]);

  const fmt = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="report-overlay">
      <div className="report-overlay-bar">
        <span className="report-overlay-title">Sub Users</span>
        <button className="report-close-btn" onClick={onClose}>✕ Close</button>
      </div>
      <div className="report-overlay-body">
        <div className="users-panel">
          {loading && (
            <div className="users-loading">
              <span className="spinner" /> Loading users…
            </div>
          )}
          {error && <div className="users-error">{error}</div>}
          {!loading && !error && users.length === 0 && (
            <div className="users-empty">No sub users have signed up yet.</div>
          )}
          {!loading && !error && users.length > 0 && (
            <table className="users-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Joined</th>
                  <th>Calls</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id}>
                    <td className="users-td-num">{i + 1}</td>
                    <td>{u.display_name || '—'}</td>
                    <td className="users-td-email">{u.email}</td>
                    <td>{fmt(u.created_at)}</td>
                    <td className="users-td-calls">{u.call_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
