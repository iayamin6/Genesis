import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const usageSchema = new Schema({ inputTokens: { type: Number, default: 0 }, outputTokens: { type: Number, default: 0 }, durationMs: { type: Number, default: 0 } }, { _id: false });
const agentResultSchema = new Schema({ agent: String, status: { type: String, enum: ['pending', 'running', 'completed', 'failed', 'skipped'], default: 'pending' }, output: Schema.Types.Mixed, error: String, usage: usageSchema }, { _id: false });

export const User = model('User', new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true }, passwordHash: String, googleId: { type: String, unique: true, sparse: true },
  createdAt: { type: Date, default: Date.now }
}));

export const Workspace = model('Workspace', new Schema({
  name: { type: String, required: true }, idea: { type: String, default: '' }, industry: String,
  members: [{ userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, role: { type: String, enum: ['founder', 'co_founder', 'viewer'], required: true } }],
  competitors: [{ name: String, url: String, lastSnapshot: Schema.Types.Mixed, lastCheckedAt: Date }],
  createdAt: { type: Date, default: Date.now }, updatedAt: { type: Date, default: Date.now }
}));

// One run model for Layer A and recurring Layer B work. `trigger` is the only scheduling distinction.
export const AgentRun = model('AgentRun', new Schema({
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  kind: { type: String, enum: ['idea_analysis', 'competitor_digest', 'runway_check', 'compliance_check', 'customer_health', 'investor_update'], required: true },
  trigger: { type: String, enum: ['manual', 'scheduled', 'milestone'], required: true },
  idempotencyKey: { type: String, required: true, unique: true },
  status: { type: String, enum: ['queued', 'running', 'completed', 'partial', 'failed'], default: 'queued' },
  agents: [agentResultSchema], output: Schema.Types.Mixed, error: String,
  artifacts: [{ key: String, bucket: String, contentType: String }],
  startedAt: Date, completedAt: Date, createdAt: { type: Date, default: Date.now }
}));

export const Alert = model('Alert', new Schema({
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  dedupeKey: { type: String, required: true, unique: true }, category: { type: String, required: true }, severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
  title: String, body: String, metadata: Schema.Types.Mixed, readAt: Date, createdAt: { type: Date, default: Date.now }
}));

export const FinancialSnapshot = model('FinancialSnapshot', new Schema({
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true }, cash: { type: Number, min: 0, required: true }, monthlyRevenue: { type: Number, min: 0, default: 0 }, monthlyExpenses: { type: Number, min: 0, required: true }, recordedAt: { type: Date, default: Date.now }
}));
