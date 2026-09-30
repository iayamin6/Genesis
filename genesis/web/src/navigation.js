export const navigation = [
  { group: 'START YOUR DAY', items: [
    ['home', 'Founder brief', 'Your next move, in focus.', 'See what changed, choose what matters, and leave with a clear next step.', '◈'],
    ['priorities', 'Risks & opportunities', 'Know what deserves attention.', 'Review the evidence behind each signal and turn it into an owned action.', '◎'],
    ['questions', 'Ask Genesis', 'Find an answer in your company.', 'Ask about customers, runway, workload, or past decisions and follow the evidence.', '✧'],
  ]},
  { group: 'UNDERSTAND THE BUSINESS', items: [
    ['teams', 'People & delivery', 'Keep important work moving.', 'See team capacity, approaching deadlines, and the customers depending on delivery.', '▦'],
    ['customers', 'Customer health', 'Protect relationships. Find growth.', 'Understand renewal pressure, usage changes, support needs, and expansion signals.', '◉'],
    ['scenarios', 'Runway & scenarios', 'See the trade-off before you commit.', 'Explore hiring, customer loss, and delivery delays against your financial baseline.', '↗'],
    ['market', 'Market watch', 'Put competitor changes in context.', 'Connect recorded market changes to the accounts and segments they may affect.', '◇'],
    ['map', 'Company map', 'See how everything connects.', 'Follow a team, project, or feature through to customers and connected revenue.', '⌘'],
  ]},
  { group: 'MOVE FORWARD', items: [
    ['actions', 'Action board', 'Give the next step an owner.', 'Track commitments, deadlines, and whether the original risk improves.', '✓'],
    ['decisions', 'Decision journal', 'Remember why. Learn what worked.', 'Save your reasoning, review the outcome, and carry the lesson into your next choice.', '▤'],
    ['foundation', 'Idea workspace', 'Pressure-test your starting point.', 'Explore your startup idea through market, risk, finance, and pitch perspectives.', '✳'],
  ]},
  { group: 'YOUR WORKSPACE', items: [
    ['data', 'Company records', 'Give Genesis the right context.', 'Manage people, projects, customers, and their relationships in one place.', '▧'],
    ['connections', 'Data connections', 'Bring your tools together.', 'Manage optional integrations. Demo data works without connecting a live account.', '⇄'],
  ]},
];
export const pages = Object.fromEntries(navigation.flatMap(g => g.items).map(([id, label, title, help, icon]) => [id, { label, title, help, icon }]));
