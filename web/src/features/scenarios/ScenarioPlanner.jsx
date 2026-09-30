import React, { useState } from 'react';
const money = (value, currency) =>
  `${currency} ${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const scenarioRunway = (result) =>
  result.projected.horizonNotDepleted
    ? `No depletion within ${result.timeline.length - 1} months`
    : runway(result.projected.runwayMonths);
const runway = (value) => (value === null ? 'No depletion at this burn rate' : `${value} months`);
function CashProjection({ result }) {
  const [month, setMonth] = useState(0);
  const timeline = result.timeline,
    chosen = timeline[Math.min(month, timeline.length - 1)];
  const values = timeline.flatMap((p) => [p.baselineCash, p.scenarioCash]);
  const minimum = Math.min(0, ...values),
    maximum = Math.max(1, ...values),
    range = maximum - minimum;
  const x = (m) => 50 + (m / (timeline.length - 1)) * 680,
    y = (value) => 195 - ((value - minimum) / range) * 165;
  const points = (key) => timeline.map((p) => `${x(p.month)},${y(p[key])}`).join(' ');
  return (
    <section className="cash-projection">
      <h4>Cash over {timeline.length - 1} months</h4>
      <div className="chart-legend">
        <span>─ Baseline</span>
        <span>━ Scenario</span>
      </div>
      <svg
        viewBox="0 0 760 225"
        role="img"
        aria-label="Baseline and scenario cash projection. Use the month control or data table for exact values."
      >
        <line x1="50" x2="730" y1={y(0)} y2={y(0)} stroke="#6f8175" strokeDasharray="4 4" />
        <text x="5" y={y(0) - 5} fill="#91a69c" fontSize="11">
          0
        </text>
        <polyline
          points={points('baselineCash')}
          fill="none"
          stroke="#8baaa0"
          strokeWidth="2"
          strokeDasharray="6 4"
        />
        <polyline points={points('scenarioCash')} fill="none" stroke="#7762d8" strokeWidth="3" />
        <line x1={x(chosen.month)} x2={x(chosen.month)} y1="25" y2="195" stroke="#677762" />
        <circle cx={x(chosen.month)} cy={y(chosen.scenarioCash)} r="5" fill="#7762d8" />
        <text x="50" y="217" fill="#91a69c" fontSize="12">
          Today
        </text>
        <text x="660" y="217" fill="#91a69c" fontSize="12">
          Month {timeline.length - 1}
        </text>
      </svg>
      <label>
        Inspect month {chosen.month}
        <input
          type="range"
          min="0"
          max={timeline.length - 1}
          step="1"
          value={chosen.month}
          onChange={(e) => setMonth(Number(e.target.value))}
        />
      </label>
      <p className="projection-values" aria-live="polite">
        Baseline: {money(chosen.baselineCash, result.currency)} · Scenario:{' '}
        {money(chosen.scenarioCash, result.currency)}
      </p>
      <details>
        <summary>View projection table</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Baseline cash</th>
                <th>Scenario cash</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((p) => (
                <tr key={p.month}>
                  <td>{p.month}</td>
                  <td>{money(p.baselineCash, result.currency)}</td>
                  <td>{money(p.scenarioCash, result.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
function FinancialBaseline({ financial, busy, onSave }) {
  return (
    <details open={!financial?.currency} className="scenario-baseline">
      <summary>
        {financial?.currency ? 'Update financial baseline' : 'Set your financial baseline'}
      </summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget));
          onSave({
            currency: f.currency,
            cash: Number(f.cash),
            monthlyRevenue: Number(f.monthlyRevenue),
            monthlyExpenses: Number(f.monthlyExpenses),
          });
        }}
      >
        <p className="muted">
          These are actual company figures. Saving creates a financial observation, not a
          hypothetical scenario.
        </p>
        <div className="scenario-fields">
          <label>
            Currency
            <select name="currency" required defaultValue={financial?.currency || ''}>
              <option value="" disabled>
                Select currency
              </option>
              {['USD', 'EUR', 'GBP', 'BDT', 'CAD', 'AUD', 'INR'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          {[
            ['cash', 'Cash available'],
            ['monthlyRevenue', 'Monthly revenue'],
            ['monthlyExpenses', 'Monthly expenses'],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                name={key}
                type="number"
                min="0"
                max="1000000000000"
                step="0.01"
                required
                defaultValue={financial?.[key] ?? ''}
              />
            </label>
          ))}
        </div>
        <button disabled={busy}>{busy ? 'Saving…' : 'Save financial baseline'}</button>
      </form>
    </details>
  );
}
export default function ScenarioPlanner({
  financial,
  forecast,
  snapshot,
  scenarios,
  readOnly,
  busy,
  onSaveFinancial,
  onCreate,
}) {
  const [selected, setSelected] = useState(null),
    [compare, setCompare] = useState([]),
    [customerSearch, setCustomerSearch] = useState('');
  const current = scenarios.find((s) => s._id === selected) || scenarios[0];
  const comparisons = scenarios.filter((s) => compare.includes(s._id));
  const compatible = financial?.currency && snapshot?.currency === financial.currency;
  return (
    <section className="scenario-planner">
      <div className="section-heading">
        <div>
          <p className="eyebrow">COMPANY FUTURE</p>
          <h3>What happens if we change course?</h3>
          <p className="muted">
            Compare a decision with the current financial baseline. Calculations use your inputs,
            not an AI prediction.
          </p>
        </div>
      </div>
      {financial && (
        <p className="muted">
          Financial baseline recorded {new Date(financial.recordedAt).toLocaleString()} · Currency{' '}
          {financial.currency || 'not specified'}
        </p>
      )}
      {!readOnly && (
        <FinancialBaseline
          key={financial?._id || 'new-finance'}
          financial={financial}
          busy={busy}
          onSave={onSaveFinancial}
        />
      )}
      {!financial?.currency && (
        <p className="sample-notice">
          A financial baseline with an explicit currency is needed before creating scenarios.
          Existing figures without currency are not assumed to match your customers.
        </p>
      )}
      {!readOnly && financial?.currency && (
        <details className="scenario-composer" open={!scenarios.length}>
          <summary>Create a scenario</summary>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const input = {
                name: form.get('name'),
                lostCustomerIds: form.getAll('lostCustomerIds'),
              };
              for (const key of [
                'hires',
                'monthlyCostPerHire',
                'revenueChangePct',
                'monthlyExpenseDelta',
                'oneTimeCost',
                'months',
                'hiringStartMonth',
                'rampMonths',
                'weeklyHoursPerHire',
                'projectDelayDays',
                'delayedRevenuePct',
              ])
                input[key] = Number(form.get(key));
              for (const key of ['teamId', 'delayedProjectId'])
                if (form.get(key)) input[key] = form.get(key);
              if (await onCreate(input)) setSelected(null);
            }}
          >
            <fieldset disabled={busy}>
              <label>
                Scenario name
                <input
                  name="name"
                  required
                  maxLength={160}
                  placeholder="For example: hire two engineers"
                />
              </label>
              <div className="scenario-fields">
                <label>
                  New hires
                  <input
                    name="hires"
                    type="number"
                    min="0"
                    max="1000"
                    step="1"
                    defaultValue="0"
                    required
                  />
                </label>
                <label>
                  Monthly cost per hire ({financial.currency})
                  <input
                    name="monthlyCostPerHire"
                    type="number"
                    min="0"
                    max="10000000"
                    step="0.01"
                    defaultValue="0"
                    required
                  />
                </label>
                <label>
                  Revenue adjustment (%)
                  <input
                    name="revenueChangePct"
                    type="number"
                    min="-100"
                    max="500"
                    step="0.1"
                    defaultValue="0"
                    required
                  />
                </label>
                <label>
                  Other monthly expense change ({financial.currency})
                  <input
                    name="monthlyExpenseDelta"
                    type="number"
                    min="-1000000000000"
                    max="1000000000000"
                    step="0.01"
                    defaultValue="0"
                    required
                  />
                </label>
                <label>
                  One-time cost ({financial.currency})
                  <input
                    name="oneTimeCost"
                    type="number"
                    min="0"
                    max="1000000000000"
                    step="0.01"
                    defaultValue="0"
                    required
                  />
                </label>
                <label>
                  Projection horizon
                  <select name="months" defaultValue="12">
                    <option value="6">6 months</option>
                    <option value="12">12 months</option>
                    <option value="24">24 months</option>
                    <option value="36">36 months</option>
                  </select>
                </label>
              </div>
              <details>
                <summary>Operational assumptions: hiring ramp and project delays</summary>
                <div className="scenario-fields">
                  <label>
                    Hiring starts after month
                    <input
                      name="hiringStartMonth"
                      type="number"
                      min="0"
                      max="24"
                      step="1"
                      defaultValue="0"
                      required
                    />
                  </label>
                  <label>
                    Ramp to full capacity (months)
                    <input
                      name="rampMonths"
                      type="number"
                      min="1"
                      max="12"
                      step="1"
                      defaultValue="3"
                      required
                    />
                  </label>
                  <label>
                    Weekly hours per new hire
                    <input
                      name="weeklyHoursPerHire"
                      type="number"
                      min="0"
                      max="80"
                      defaultValue="40"
                      required
                    />
                  </label>
                  <label>
                    Team receiving capacity
                    <select name="teamId">
                      <option value="">No team assumption</option>
                      {snapshot?.teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Delayed project
                    <select name="delayedProjectId">
                      <option value="">No project delay</option>
                      {snapshot?.projects
                        .filter((p) => p.completion < 100)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Additional delay (days)
                    <input
                      name="projectDelayDays"
                      type="number"
                      min="0"
                      max="365"
                      step="1"
                      defaultValue="0"
                      required
                    />
                  </label>
                  <label>
                    Linked monthly revenue deferred (%)
                    <input
                      name="delayedRevenuePct"
                      type="number"
                      min="0"
                      max="100"
                      defaultValue="0"
                      required
                    />
                  </label>
                </div>
                <p className="muted">
                  Capacity and delayed revenue are your assumptions. Genesis does not infer employee
                  productivity or assume that a delayed feature will cause churn.
                </p>
              </details>
              <p className="muted">
                Revenue adjustment applies once after selected customer losses. Negative expense
                changes represent savings. Include benefits and overhead in hiring cost.
              </p>
              <details>
                <summary>Model losing specific customers</summary>
                {compatible ? (
                  <>
                    <label>
                      Find customers
                      <input
                        type="search"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder="Search customer names…"
                      />
                    </label>
                    <div className="relationship-options">
                      {snapshot.customers.map((c) => (
                        <label
                          key={c.id}
                          hidden={!c.name.toLowerCase().includes(customerSearch.toLowerCase())}
                        >
                          <input name="lostCustomerIds" type="checkbox" value={c.id} />
                          {c.name} · {money(c.arrMinor / 100, financial.currency)} ARR
                        </label>
                      ))}
                    </div>
                    {snapshot.source.kind === 'sample' && (
                      <p className="sample-notice">
                        These customers are synthetic sample data. Any selected losses are
                        hypothetical demo inputs.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="muted">
                    Import customers in the same currency as your financial baseline to enable
                    customer-loss scenarios.
                  </p>
                )}
              </details>
              <button>{busy ? 'Calculating…' : 'Calculate & save scenario'}</button>
            </fieldset>
          </form>
        </details>
      )}
      {forecast && (
        <details className="historical-forecast">
          <summary>Historical financial trend</summary>
          {forecast.available ? (
            <>
              <p>
                {forecast.sampleCount} comparable observations ·{' '}
                {new Date(forecast.firstObservedAt).toLocaleDateString()} to{' '}
                {new Date(forecast.lastObservedAt).toLocaleDateString()}
              </p>
              <p className="muted">{forecast.method}</p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Month ahead</th>
                      <th>Revenue trend</th>
                      <th>Expense trend</th>
                      <th>Cash trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.timeline.map((row) => (
                      <tr key={row.month}>
                        <td>{row.month}</td>
                        <td>{money(row.monthlyRevenue, forecast.currency)}</td>
                        <td>{money(row.monthlyExpenses, forecast.currency)}</td>
                        <td>{money(row.cash, forecast.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted">{forecast.limitations}</p>
            </>
          ) : (
            <p className="muted">{forecast.reason}</p>
          )}
        </details>
      )}
      {!!scenarios.length && (
        <>
          <div className="scenario-saved">
            <h4>Saved scenarios</h4>
            <div className="scenario-cards">
              {scenarios.map((s) => (
                <div className={current?._id === s._id ? 'selected-scenario' : ''} key={s._id}>
                  <button
                    className="scenario-select"
                    aria-pressed={current?._id === s._id}
                    onClick={() => setSelected(s._id)}
                  >
                    <strong>{s.name}</strong>
                    <span>{scenarioRunway(s.result)}</span>
                    <small>{new Date(s.createdAt).toLocaleString()}</small>
                  </button>
                  <label className="graph-toggle">
                    <input
                      type="checkbox"
                      checked={compare.includes(s._id)}
                      disabled={!compare.includes(s._id) && compare.length >= 3}
                      onChange={(e) =>
                        setCompare((old) =>
                          e.target.checked ? [...old, s._id] : old.filter((id) => id !== s._id),
                        )
                      }
                    />
                    Compare
                  </label>
                </div>
              ))}
            </div>
          </div>
          {comparisons.length > 0 && (
            <section>
              <h4>Compare up to three saved scenarios</h4>
              <p className="muted">
                Each scenario retains its own baseline date and currency. Different baselines are
                not directly comparable.
              </p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Scenario</th>
                      <th>Baseline date</th>
                      <th>Baseline runway</th>
                      <th>Scenario runway</th>
                      <th>Final-horizon net burn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisons.map((s) => (
                      <tr key={s._id}>
                        <td>{s.name}</td>
                        <td>{new Date(s.result.financialObservedAt).toLocaleDateString()}</td>
                        <td>{runway(s.result.baseline.runwayMonths)}</td>
                        <td>{scenarioRunway(s.result)}</td>
                        <td>{money(s.result.projected.netBurn, s.result.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {current && (
            <section className="scenario-result">
              <h3>{current.name}</h3>
              <div className="evidence-metrics">
                <div>
                  <strong>{runway(current.result.baseline.runwayMonths)}</strong>
                  <span>Baseline runway</span>
                </div>
                <div>
                  <strong>{scenarioRunway(current.result)}</strong>
                  <span>Scenario runway</span>
                </div>
                <div>
                  <strong>
                    {money(current.result.projected.netBurn, current.result.currency)}
                  </strong>
                  <span>Final-horizon monthly net burn · negative means surplus</span>
                </div>
              </div>
              {current.result.projected.immediateFundingGap > 0 && (
                <p className="error">
                  One-time costs exceed available cash by{' '}
                  {money(current.result.projected.immediateFundingGap, current.result.currency)}.
                </p>
              )}
              {current.result.operational && (
                <section>
                  <h4>Operational assumptions</h4>
                  {current.result.operational.teamName && (
                    <p>
                      {current.result.operational.teamName}: weekly capacity{' '}
                      {current.result.operational.baselineCapacity} →{' '}
                      {current.result.operational.finalCapacity} hours by the end of the horizon;
                      allocated work held at {current.result.operational.allocatedHours} hours.
                    </p>
                  )}
                  {current.result.operational.projectName && (
                    <p>
                      {current.result.operational.projectName}: assumed due date{' '}
                      {current.result.operational.originalDueDate} →{' '}
                      {current.result.operational.assumedDueDate}. Assumed monthly revenue deferred:{' '}
                      {money(
                        current.result.operational.delayedMonthlyRevenue,
                        current.result.currency,
                      )}
                      .
                    </p>
                  )}
                </section>
              )}
              <CashProjection key={current._id} result={current.result} />
              <details>
                <summary>Assumptions and source data</summary>
                <p>
                  Financial baseline:{' '}
                  {new Date(current.result.financialObservedAt).toLocaleString()} · Company
                  observation:{' '}
                  {current.result.companyObservedAt
                    ? new Date(current.result.companyObservedAt).toLocaleString()
                    : 'None'}
                </p>
                <p>
                  {current.assumptions.hires} hires at{' '}
                  {money(current.assumptions.monthlyCostPerHire, current.result.currency)} per month
                  each · Revenue adjustment {current.assumptions.revenueChangePct}% · Other monthly
                  expense change{' '}
                  {money(current.assumptions.monthlyExpenseDelta, current.result.currency)} ·
                  One-time cost {money(current.assumptions.oneTimeCost, current.result.currency)}
                </p>
                <p>
                  Selected customer loss:{' '}
                  {money(current.result.lostMonthlyRevenue, current.result.currency)} per month
                </p>
                {current.result.customers.map((c) => (
                  <p key={c.id}>
                    {c.name} · {money(c.arrMinor / 100, current.result.currency)} ARR
                  </p>
                ))}
                {current.result.customers.length > 0 &&
                  current.result.companySource?.kind === 'sample' && (
                    <p className="sample-notice">
                      Selected customers came from synthetic sample data.
                    </p>
                  )}
                <ul>
                  {current.result.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </details>
            </section>
          )}
        </>
      )}
      {!scenarios.length && (
        <div className="empty-state">
          <h4>No scenarios saved yet</h4>
          <p>
            Start with one change and compare it with the baseline before combining assumptions.
          </p>
        </div>
      )}
      <p className="muted">
        Showing the latest {scenarios.length} saved scenarios, up to 20. Scenarios do not change
        your actual financial or company records.
      </p>
    </section>
  );
}
