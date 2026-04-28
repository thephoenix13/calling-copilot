import { useState } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'forgot'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = (newMode) => {
    setMode(newMode);
    setError('');
    setSuccess('');
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (mode === 'forgot' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'forgot') {
        const res = await fetch(`${BACKEND_URL}/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, newPassword: password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Password reset failed.');
          return;
        }
        setSuccess('Password updated. You can now sign in.');
        setPassword('');
        setConfirmPassword('');
        return;
      }

      const endpoint = mode === 'login' ? '/auth/login' : '/auth/signup';
      const body = mode === 'login'
        ? { email, password }
        : { email, password, name };

      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `${mode === 'login' ? 'Login' : 'Signup'} failed.`);
        return;
      }
      localStorage.setItem('authToken', data.token);
      onLogin(data.role, data.token, data.displayName);
    } catch {
      setError('Could not reach the server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === 'login';

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">📞</div>
        <h1 className="login-title">Recruiter Call App</h1>

        {mode !== 'forgot' ? (
          <div className="login-tabs">
            <button
              className={`login-tab${isLogin ? ' active' : ''}`}
              type="button"
              onClick={() => reset('login')}
            >
              Sign in
            </button>
            <button
              className={`login-tab${mode === 'signup' ? ' active' : ''}`}
              type="button"
              onClick={() => reset('signup')}
            >
              Sign up
            </button>
          </div>
        ) : (
          <div style={{ width: '100%', marginBottom: '4px' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-2)', margin: 0 }}>
              Enter your email and choose a new password.
            </p>
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="login-field">
              <label className="login-label">Name</label>
              <input
                className="login-input"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                placeholder="Your full name"
                autoFocus
                disabled={loading}
              />
            </div>
          )}

          <div className="login-field">
            <label className="login-label">Email</label>
            <input
              className="login-input"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); setSuccess(''); }}
              placeholder="you@example.com"
              autoFocus={isLogin || mode === 'forgot'}
              disabled={loading}
            />
          </div>

          <div className="login-field">
            <label className="login-label">{mode === 'forgot' ? 'New Password' : 'Password'}</label>
            <input
              className="login-input"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          {(mode === 'signup' || mode === 'forgot') && (
            <div className="login-field">
              <label className="login-label">Confirm Password</label>
              <input
                className="login-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                placeholder="••••••••"
                disabled={loading}
              />
            </div>
          )}

          {error && <div className="login-error">{error}</div>}
          {success && <div className="login-success">{success}</div>}

          <button className="login-btn" type="submit" disabled={loading}>
            {loading
              ? (mode === 'forgot' ? 'Updating…' : isLogin ? 'Signing in…' : 'Creating account…')
              : (mode === 'forgot' ? 'Reset Password' : isLogin ? 'Sign in' : 'Create account')}
          </button>

          {isLogin && (
            <button
              type="button"
              className="login-link"
              onClick={() => reset('forgot')}
            >
              Forgot password?
            </button>
          )}

          {mode === 'forgot' && (
            <button
              type="button"
              className="login-link"
              onClick={() => reset('login')}
            >
              ← Back to sign in
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
