import mongoose from 'mongoose';
const { Schema, model } = mongoose;
export const Connection = model(
  'Connection',
  new Schema(
    {
      workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
      name: String,
      provider: { type: String, enum: ['github', 'ingestion'], required: true },
      enabled: { type: Boolean, default: false },
      repository: String,
      projectId: String,
      syncProjectProgress: { type: Boolean, default: false },
      encryptedToken: { type: String, select: false },
      webhookHash: { type: String, select: false },
      status: { type: String, default: 'idle' },
      lastSyncedAt: Date,
      lastError: String,
      leaseUntil: Date,
      issueCount: Number,
      closedIssueCount: Number,
      createdBy: Schema.Types.ObjectId,
    },
    { timestamps: true },
  ),
);
const workSchema = new Schema({
  workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
  connectionId: { type: Schema.Types.ObjectId, required: true },
  number: Number,
  title: String,
  state: String,
  url: String,
  projectId: String,
  assignees: [String],
  updatedAtSource: Date,
  syncedAt: Date,
});
workSchema.index({ connectionId: 1, number: 1 }, { unique: true });
export const ExternalWork = model('ExternalWork', workSchema);
const dispatchSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true },
    actionId: { type: Schema.Types.ObjectId, required: true },
    connectionId: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, enum: ['publishing', 'published', 'uncertain', 'failed'] },
    issueNumber: Number,
    url: String,
    error: String,
    sentTitle: String,
    sentBody: String,
    publishedBy: Schema.Types.ObjectId,
    lastSyncedAt: Date,
  },
  { timestamps: true },
);
dispatchSchema.index({ actionId: 1 }, { unique: true });
export const TaskDispatch = model('TaskDispatch', dispatchSchema);
