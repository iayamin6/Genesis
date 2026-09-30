import React from 'react';
const cash = (v, c = 'USD') => new Intl.NumberFormat(undefined, { style: 'currency', currency: c, maximumFractionDigits: 0, notation: 'compact' }).format(v);
export default function FounderBrief({ data, signals, onNavigate, onSignal }) {
  const snapshot = data?.latest?.snapshot, financial = data?.financial;
  if (!snapshot) return <section className="brief-welcome"><span className="hero-orbit">✧</span><p className="eyebrow">A LITTLE CONTEXT. A CLEARER NEXT MOVE.</p><h2>Let’s connect your company.</h2><p>Choose the synthetic demo workspace to explore, or add your own people, projects, and customers.</p><button onClick={() => onNavigate('data')}>Add company records →</button></section>;
  const active = (data.actions || []).filter(a => !['completed', 'cancelled'].includes(a.status));
  const attention = signals.filter(s => s.severity !== 'opportunity'), opportunities = signals.filter(s => s.severity === 'opportunity');
  const burn = financial && financial.monthlyExpenses - financial.monthlyRevenue;
  const next = [...active].sort((a,b) => a.dueDate.localeCompare(b.dueDate)).slice(0,3);
  return <div className="founder-brief">
    <section className="brief-welcome"><div><p className="eyebrow">YOUR COMPANY AT A GLANCE</p><h2>A little clarity.<br/>A better next move.</h2><p>{attention.length} signals deserve a look. {opportunities.length} opportunities are worth exploring.</p><button onClick={() => onNavigate('priorities')}>Review what matters <span>↗</span></button></div><div className="orbit-art" aria-hidden="true"><div className="orbit-ring"/><div className="orbit-ring second"/><div className="orbit-core">✧</div><span className="orbit-label first">People</span><span className="orbit-label second">Customers</span><span className="orbit-label third">Your next move</span></div></section>
    <div className="brief-metrics">{[
      ['priorities', String(attention.length), 'Signals to review', 'Start with the evidence', 'amber'],
      ['scenarios', financial ? burn > 0 ? `${(financial.cash / burn).toFixed(1)} mo` : 'No net burn' : 'Add baseline', 'Cash runway', financial ? `${cash(financial.cash,financial.currency)} cash available` : 'See your financial horizon', 'violet'],
      ['customers', cash(snapshot.customers.reduce((n,c)=>n+c.arrMinor/100,0),snapshot.currency), 'Recorded customer ARR', `${snapshot.customers.length} connected accounts`, 'green'],
      ['actions', String(active.length), 'Open commitments', 'Every next step has an owner', 'blue'],
    ].map(([id,value,label,detail,color])=><button className={`brief-metric ${color}`} key={id} onClick={()=>onNavigate(id)}><span>{label}<span>↗</span></span><strong>{value}</strong><small>{detail}</small></button>)}</div>
    <div className="brief-columns"><section className="brief-panel"><div className="section-heading"><h3>Start here today</h3><a href="#/priorities">All signals →</a></div>{signals.slice(0,3).map((s,i)=><button className="brief-row" key={s.key} onClick={()=>onSignal(s.key)}><span className={`row-dot ${s.severity}`}>{String(i+1).padStart(2,'0')}</span><span><strong>{s.title}</strong><small>{s.customers.length} connected accounts · {cash(s.evidence.arrMinor/100,s.evidence.currency)} ARR</small></span><span>↗</span></button>)}{!signals.length && <p className="muted">No rules currently trigger on this observation.</p>}</section>
    <section className="brief-panel"><div className="section-heading"><h3>Keep things moving</h3><a href="#/actions">Action board →</a></div>{next.map(a=><button className="brief-row" key={a._id} onClick={()=>onNavigate('actions')}><span className="owner-avatar">{a.ownerName?.[0] || '·'}</span><span><strong>{a.title.replace(/^Demo: /,'')}</strong><small>{a.ownerName} · Due {a.dueDate}</small></span><span className="tiny-status">{a.status === 'in_progress' ? 'In progress' : 'To do'}</span></button>)}{!next.length && <p className="muted">Assign a next step from a signal to start tracking progress.</p>}</section></div>
    <section className="journey-strip"><div><span className="journey-spark">✧</span><strong>Explore the complete loop</strong><span className="muted">Understand → act → learn</span></div><a href="#/map">Follow a connection →</a><a href="#/scenarios">Try a what-if →</a><a href="#/decisions">See what worked →</a></section>
  </div>;
}
