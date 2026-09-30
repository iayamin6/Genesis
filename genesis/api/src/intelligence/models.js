import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const evaluationSchema = new Schema({
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  key: { type: String, required: true }, payloadHash: String,
  snapshot: { type: Schema.Types.Mixed, required: true }, analysis: { type: Schema.Types.Mixed, required: true },
  observedAt: { type: Date, required: true }, evaluatedAt: { type: Date, required: true },
}, { timestamps: true });
evaluationSchema.index({ workspaceId: 1, key: 1 }, { unique: true });
evaluationSchema.index({ workspaceId: 1, observedAt: -1, evaluatedAt: -1 });
export const CompanyEvaluation = model('CompanyEvaluation', evaluationSchema);
export const CompanyAction = model('CompanyAction', new Schema({
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  riskKey: String, title: String, ownerId: String, ownerName: String, dueDate: String, reason: String, expectedResult: String,
  status: { type: String, enum: ['open', 'in_progress', 'completed', 'cancelled'], default: 'open' },
  baseline: Schema.Types.Mixed, baselineObservedAt: Date, customerIds: [String], completedAt: Date,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true }));

const decisionSchema = new Schema({
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  requestId: { type: String, required: true },
  title: String, reason: String, expectedResult: String, alternatives: String,
  ownerId: String, ownerName: String, reviewDate: String, initialReviewDate: String,
  signalKey: String, signalTitle: String, baselineSource: Schema.Types.Mixed, baseline: Schema.Types.Mixed, baselineObservedAt: Date,
  actionIds: [{ type: Schema.Types.ObjectId, ref: 'CompanyAction' }],
  status: { type: String, enum: ['open', 'reviewed'], default: 'open' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }, createdByName: String,
  reviews: [{ requestId: String, source: Schema.Types.Mixed, result: { type: String, enum: ['achieved', 'partial', 'not_achieved', 'unknown'] }, actualResult: String, lesson: String, nextReviewDate: String, reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' }, reviewerName: String, reviewedAt: { type: Date, default: Date.now }, evidence: Schema.Types.Mixed, observedAt: Date }],
}, { timestamps: true });
decisionSchema.index({ workspaceId: 1, requestId: 1 }, { unique: true });
export const CompanyDecision = model('CompanyDecision', decisionSchema);

export const CompanyScenario = model('CompanyScenario', new Schema({
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  name: String, assumptions: Schema.Types.Mixed, result: Schema.Types.Mixed,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true }));
