import mongoose from 'mongoose';
const { Schema, model } = mongoose;
export const CompanyQuestion = model('CompanyQuestion', new Schema({ workspaceId: { type: Schema.Types.ObjectId, required: true, index: true }, userId: Schema.Types.ObjectId, question: String, answer: String, evidence: [Schema.Types.Mixed] }, { timestamps: true }));
const tokens = s => s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
export function answerCompanyQuestion(question, context) {
  const { latest, financial, actions, decisions, scenarios } = context;
  const evidence = [], docs = [], q = question.toLowerCase();
  const push = (id, view, title, text, tags = '') => docs.push({ id, view, title, text, tags });
  if (latest) {
    const a = latest.analysis, snap = latest.snapshot;
    for (const s of [...a.risks, ...(a.customerSignals || []), ...(a.marketSignals || [])]) push(s.key, 'priorities', s.title, `${s.explanation} ${s.consequence} Suggested next steps: ${s.recommendations.join('; ')}. Evidence observed ${snap.observedAt}.`, 'risk attention problems recommend action opportunity why customer');
    for (const team of a.teamHealth?.teams || []) push(`team:${team.id}`, 'teams', team.name, `${team.allocatedHours} weekly hours allocated against ${team.capacityHours} hours capacity. ${team.projects.length} active projects. ${team.flags.map(f => f.title).join(' ')} ${team.recommendations.join(' ')}`, 'team workload employee capacity bottleneck');
    for (const c of snap.customers) push(`customer:${c.id}`, 'customers', c.name, `Recorded ARR: ${snap.currency} ${(c.arrMinor / 100).toFixed(2)}. Renewal: ${c.renewalDate || 'unknown'}. Open support issues: ${c.openSupportIssues}. Pricing concern: ${c.pricingConcern || 'not recorded'}. Segment: ${c.segment || 'not recorded'}.`, 'customer account revenue renewal');
  }
  if (financial) { const burn = financial.monthlyExpenses - financial.monthlyRevenue; push(`finance:${financial._id}`, 'scenarios', 'Financial baseline', `Cash ${financial.currency || '(currency unspecified)'} ${financial.cash}; monthly revenue ${financial.monthlyRevenue}; monthly expenses ${financial.monthlyExpenses}; net monthly burn ${burn}; runway ${burn > 0 ? `${Math.floor(financial.cash / burn * 10) / 10} months` : 'no finite depletion under a constant nonpositive burn rate'}. Recorded ${new Date(financial.recordedAt).toISOString()}.`, 'cash future runway finance burn'); }
  for (const a of actions) push(`action:${a._id}`, 'actions', a.title, `Owner ${a.ownerName}; due ${a.dueDate}; status ${a.status}. Reason: ${a.reason}. Expected: ${a.expectedResult}.`, 'action task owner status due');
  for (const d of decisions) push(`decision:${d._id}`, 'decisions', d.title, `Reason: ${d.reason}. Expected: ${d.expectedResult}. Status ${d.status}. Review ${d.reviewDate}. Recorded lessons: ${d.reviews.map(r => `${r.actualResult}; ${r.lesson}`).join(' | ') || 'No outcome review yet'}.`, 'decision history lesson outcome worked why');
  for (const s of scenarios) push(`scenario:${s._id}`, 'scenarios', s.name, `Saved hypothetical scenario: baseline runway ${s.result.baseline.runwayMonths ?? 'no finite depletion'}; scenario runway ${s.result.projected.horizonNotDepleted ? `no depletion within ${s.result.timeline.length - 1} months` : s.result.projected.runwayMonths ?? 'no finite depletion'}. Assumptions: ${s.result.assumptions.join(' ')}`, 'what if scenario forecast hiring');
  const normalizedQuestion = q.replace(/customers/g, 'customer').replace(/teams/g, 'team').replace(/decisions/g, 'decision').replace(/actions/g, 'action').replace(/lessons/g, 'lesson') + (/should|attention|priorit/.test(q) ? ' risk recommend action' : '');
  const words = [...new Set(tokens(normalizedQuestion).filter(w => w.length > 2 && !['what', 'the', 'does', 'with', 'that', 'this', 'are', 'can', 'our', 'how', 'and', 'for', 'company'].includes(w)))];
  const ranked = docs.map(d => ({ ...d, score: words.reduce((sum, w) => sum + (d.title.toLowerCase().includes(w) ? 5 : 0) + (d.text.toLowerCase().includes(w) ? 2 : 0) + (d.tags.includes(w) ? 1 : 0), 0) })).filter(d => d.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
  if (!ranked.length) return { answer: 'I do not have matching recorded evidence for that question. Try a customer or team name, runway, active actions, decisions, or a saved scenario. Missing data is not filled in.', evidence: [] };
  ranked.forEach(({ tags, score, ...d }) => evidence.push(d));
  return { answer: `I found ${evidence.length} relevant company records.\n\n${evidence.map((d, i) => `[${i + 1}] ${d.title}: ${d.text}`).join('\n\n')}\n\nThis answer retrieves recorded evidence; it does not infer causes, make an unrecorded forecast, or interpret missing facts.`, evidence };
}
