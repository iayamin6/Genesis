import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import './styles.css';
import CommandCenter from './features/company/CommandCenter.jsx';
import { navigation, pages } from './lib/navigation.js';
import './founder.css';

const API = import.meta.env.VITE_API_URL ?? '';
async function request(path, options = {}, _accountId) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      ...options,
      credentials: 'same-origin',
      signal: AbortSignal.timeout(20000),
      headers: {
        'Content-Type': 'application/json',

        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      `Cannot reach the Genesis API at ${API || location.origin}. Start the API service, then try again.`,
    );
  }
  const data = await res
    .json()
    .catch(() => ({ error: 'The service is unavailable. Please try again.' }));
  if (!res.ok) {
    const details = data.details
      ?.slice(0, 3)
      .map((issue) => `${issue.path?.join('.') || 'Input'}: ${issue.message}`)
      .join('; ');
    const error = new Error(details || data.error || 'Request failed');
    error.status = res.status;
    throw error;
  }
  return data;
}

function Auth({ onAuthenticated }) {
  const [mode, setMode] = useState('register');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await request(`/api/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      onAuthenticated(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <main className="auth">
      <section>
        <p className="eyebrow">GENESIS / FOUNDER INTELLIGENCE</p>
        <h1>Make the next decision before it makes you.</h1>
        <p>
          Grounded startup analysis, live runway, and competitor signals in one self-hosted
          workspace.
        </p>
      </section>
      <form onSubmit={submit}>
        <h2>{mode === 'register' ? 'Create your workspace' : 'Welcome back'}</h2>
        {mode === 'register' && (
          <input
            placeholder="Your name"
            aria-label="Your name"
            autoComplete="name"
            required
            maxLength={120}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        )}
        <input
          placeholder="Email"
          aria-label="Email"
          autoComplete="email"
          required
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          placeholder="Password (8+ characters)"
          aria-label="Password"
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          required
          minLength={8}
          maxLength={72}
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        {error && <p className="error">{error}</p>}
        <button disabled={submitting}>
          {submitting ? 'Please wait…' : mode === 'register' ? 'Start building' : 'Sign in'}
        </button>
        <p className="muted">Sign in with email. Your company data is saved to your account.</p>
        <button
          type="button"
          className="link"
          onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
        >
          {mode === 'register' ? 'Already have an account?' : 'Need an account?'}
        </button>
      </form>
    </main>
  );
}

function App() {
  const [session, setSession] = useState(null),
    [checking, setChecking] = useState(true),
    [serviceError, setServiceError] = useState('');
  useEffect(() => {
    localStorage.removeItem('genesis-session');
    request('/api/auth/me')
      .then(setSession)
      .catch((e) => {
        if (e.status !== 401) setServiceError(e.message);
      })
      .finally(() => setChecking(false));
  }, []);
  const getView = () => (pages[location.hash.slice(2)] ? location.hash.slice(2) : 'home');
  const [view, setView] = useState(getView),
    [workspaces, setWorkspaces] = useState([]),
    [workspace, setWorkspace] = useState(null),
    [events, setEvents] = useState([]),
    [run, setRun] = useState(null),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false),
    [workspaceName, setWorkspaceName] = useState(''),
    [creating, setCreating] = useState(false),
    [navOpen, setNavOpen] = useState(false);
  const token = session?.user?.id;
  const navigate = (target) => {
    location.hash = `/${target}`;
    setView(target);
    setNavOpen(false);
    document.querySelector('.workspace-main')?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  };
  useEffect(() => {
    const change = () => {
      setView(getView());
      setNavOpen(false);
      document.querySelector('.workspace-main')?.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    if (!token) return;
    let active = true;
    request('/api/workspaces', {}, token)
      .then((items) => {
        if (!active) return;
        setWorkspaces(items);
        setWorkspace(
          items.find((w) => w._id === localStorage.getItem('genesis-workspace')) ||
            items.find((w) => w.name.includes('Genesis Demo')) ||
            items[0] ||
            null,
        );
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [token]);
  useEffect(() => {
    if (!workspace) return;
    localStorage.setItem('genesis-workspace', workspace._id);
    setRun(null);
    setEvents([]);
    if (!import.meta.env.DEV && !import.meta.env.VITE_SOCKET_URL) return;
    const socket = io(import.meta.env.VITE_SOCKET_URL || API, { withCredentials: true });
    socket.on('connect', () => socket.emit('workspace:join', workspace._id));
    socket.on('agent:progress', (e) => setEvents((old) => [...old, e]));
    return () => socket.close();
  }, [workspace?._id, token]);
  useEffect(() => {
    if (!run?._id || !['queued', 'running'].includes(run.status)) return;
    let active = true;
    const timer = setInterval(
      () =>
        request('/api/runs/' + run._id)
          .then((value) => {
            if (active) setRun(value);
          })
          .catch(() => {}),
      5000,
    );
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [run?._id, run?.status]);
  if (checking)
    return (
      <main className="auth">
        <p>Opening your account…</p>
      </main>
    );
  if (serviceError)
    return (
      <main className="auth">
        <section>
          <h1>Temporarily unavailable</h1>
          <p>{serviceError}</p>
          <button onClick={() => location.reload()}>Try again</button>
        </section>
      </main>
    );
  if (!session)
    return (
      <Auth
        onAuthenticated={(s) => {
          setServiceError('');
          setSession(s);
        }}
      />
    );
  async function createWorkspace(e) {
    e.preventDefault();
    setPending(true);
    setError('');
    try {
      const w = await request(
        '/api/workspaces',
        { method: 'POST', body: JSON.stringify({ name: workspaceName.trim() }) },
        token,
      );
      setWorkspaces((old) => [...old, w]);
      setWorkspace(w);
      setWorkspaceName('');
      setCreating(false);
      navigate('home');
    } catch (e) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  }
  async function analyze(e) {
    e.preventDefault();
    const idea = new FormData(e.currentTarget).get('idea');
    setPending(true);
    setError('');
    try {
      setRun(
        await request(
          `/api/runs/workspaces/${workspace._id}/idea-analysis`,
          {
            method: 'POST',
            headers: { 'Idempotency-Key': crypto.randomUUID() },
            body: JSON.stringify({ idea }),
          },
          token,
        ),
      );
      setEvents([]);
    } catch (e) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  }
  const page = pages[view];
  return (
    <div
      className="shell founder-shell"
      onClick={(e) => {
        if (e.target.closest('a[href^="#/"]')) window.dispatchEvent(new Event('genesis:nav-link'));
      }}
    >
      <a
        className="skip-link"
        href="#page-title"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('page-title')?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className={navOpen ? 'founder-sidebar nav-open' : 'founder-sidebar'}>
        <a className="brand" href="#/home">
          <span className="brand-mark">✳</span> genesis<span className="brand-period">.</span>
        </a>
        <label className="workspace-picker">
          WORKSPACE
          <select
            aria-label="Choose workspace"
            value={workspace?._id || ''}
            onChange={(e) => {
              setWorkspace(workspaces.find((w) => w._id === e.target.value));
              navigate('home');
            }}
          >
            <option value="" disabled>
              Select workspace
            </option>
            {workspaces.map((w) => (
              <option key={w._id} value={w._id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <nav aria-label="Founder workspace">
          {navigation.map((group) => (
            <div className="nav-group" key={group.group}>
              <p>{group.group}</p>
              {group.items.map(([id, label, , , icon]) => (
                <a
                  key={id}
                  href={`#/${id}`}
                  aria-current={view === id ? 'page' : undefined}
                  className={view === id ? 'nav-item active' : 'nav-item'}
                  onClick={() => setNavOpen(false)}
                >
                  <span aria-hidden="true">{icon}</span>
                  {label}
                  {view === id && <i />}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="quiet-button" onClick={() => setCreating(!creating)}>
            ＋ New workspace
          </button>
          <button
            className="account-button"
            onClick={async () => {
              try {
                await request('/api/auth/logout', { method: 'POST' });
                setSession(null);
                setWorkspace(null);
                setWorkspaces([]);
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            <span className="owner-avatar">{session.user?.name?.[0] || 'G'}</span>
            <span>
              {session.user?.name || 'Your account'}
              <small>Sign out</small>
            </span>
            <span>↗</span>
          </button>
        </div>
      </aside>
      <main className="workspace-main">
        <div className="workspace-topbar">
          <button
            className="mobile-menu quiet-button"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(!navOpen)}
          >
            ☰ Menu
          </button>
          <span>
            Workspace <span className="breadcrumb-divider">/</span> {page.label}
          </span>
          <div>
            <span className="local-pill">
              <i /> Founder workspace
            </span>
            <a href="#/questions" className="ask-shortcut">
              ✧ Ask Genesis
            </a>
          </div>
        </div>
        <header className="page-header">
          <div>
            <p className="eyebrow">{page.label}</p>
            <h1 id="page-title" tabIndex="-1">
              {page.title}
            </h1>
            <p>{page.help}</p>
          </div>
          <span className="page-symbol" aria-hidden="true">
            {page.icon}
          </span>
        </header>
        {workspace?.name.includes('Synthetic') && (
          <div className="demo-ribbon">
            <span>
              ✧ <strong>Demo workspace</strong> · Fictional data, real interactions.
            </span>
            <a href="#/data">Explore the records →</a>
          </div>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {creating && (
          <form className="workspace-create" onSubmit={createWorkspace}>
            <label>
              Workspace name
              <input
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                required
                maxLength={120}
              />
            </label>
            <button disabled={pending}>Create workspace</button>
            <button type="button" className="quiet-button" onClick={() => setCreating(false)}>
              Cancel
            </button>
          </form>
        )}
        {workspace ? (
          <>
            <div hidden={view === 'foundation'}>
              <CommandCenter
                key={workspace._id}
                workspace={workspace}
                request={request}
                token={token}
                view={view}
                onNavigate={navigate}
              />
            </div>
            {view === 'foundation' && (
              <section className="foundation-workspace">
                <div className="brief-panel">
                  <p className="eyebrow">01 / DEFINE YOUR IDEA</p>
                  <h3>What are you building?</h3>
                  <p className="muted">
                    Describe the customer, the problem, and your approach. This workspace retains
                    the original seven-perspective analysis.
                  </p>
                  <form onSubmit={analyze}>
                    <label>
                      Startup brief
                      <textarea
                        name="idea"
                        defaultValue={workspace.idea}
                        minLength={20}
                        required
                        placeholder="Who is it for, what do they need, and why now?"
                      />
                    </label>
                    <button disabled={pending}>
                      {pending ? 'Starting…' : 'Explore this idea →'}
                    </button>
                  </form>
                  <p className="muted">
                    Live model setup is optional. Without a provider, results are explicitly labeled
                    as fallback output.
                  </p>
                </div>
                <div className="brief-panel">
                  <p className="eyebrow">02 / EXPLORE THE PERSPECTIVES</p>
                  <Trace events={events} run={run} />
                </div>
              </section>
            )}
          </>
        ) : (
          <section className="empty-state">
            <h2>Your workspace starts here.</h2>
            <p>Create a workspace to bring your company context together.</p>
            <button onClick={() => setCreating(true)}>Create workspace →</button>
          </section>
        )}
        <footer className="workspace-footer">
          <span>genesis · A clearer view of your company</span>
          <a href="#/home">Back to founder brief ↑</a>
        </footer>
      </main>
    </div>
  );
}
function Trace({ events, run }) {
  const agents = [
    'market_research',
    'risk_analysis',
    'legal_scout',
    'competitive_intelligence',
    'assumption_stress_tester',
    'financial_modelling',
    'pitch_writer',
  ];
  const states = Object.fromEntries(events.filter((e) => e.agent).map((e) => [e.agent, e.type]));
  return (
    <div className="trace">
      <h3>{run ? `Analysis ${run.status}` : 'Agent trace'}</h3>
      <div className="agent-grid">
        {agents.map((a) => (
          <div
            key={a}
            className={
              states[a] === 'agent_finished'
                ? 'done'
                : states[a] === 'agent_started'
                  ? 'running'
                  : ''
            }
          >
            {a.replaceAll('_', ' ')}
          </div>
        ))}
      </div>
      {events
        .filter((e) => e.type === 'agent_finished')
        .map((e, i) => (
          <details key={i}>
            <summary>
              {e.agent} · {e.status}
            </summary>
            <pre>{JSON.stringify(e.output, null, 2)}</pre>
          </details>
        ))}
    </div>
  );
}
createRoot(document.getElementById('root')).render(<App />);
