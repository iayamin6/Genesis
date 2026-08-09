import { agentQueue } from './queue.js';
import { Workspace, AgentRun } from '../models.js';

// One repeatable dispatcher keeps schedule configuration in code and makes all generated jobs explicit/idempotent.
export async function configureScheduler() {
  await agentQueue.add({ type: 'daily-dispatch' }, { jobId: 'daily-dispatch', repeat: { cron: '0 7 * * *' }, removeOnComplete: true });
}
export async function dispatchDaily() {
  const day = new Date().toISOString().slice(0, 10);
  for await (const workspace of Workspace.find({ 'competitors.0': { $exists: true } }).cursor()) {
    const key = `competitor-digest:${workspace.id}:${day}`;
    let run = await AgentRun.findOne({ idempotencyKey: key });
    if (!run) { run = await AgentRun.create({ workspaceId: workspace._id, kind: 'competitor_digest', trigger: 'scheduled', idempotencyKey: key }); await agentQueue.add({ runId: run.id }, { jobId: run.id, attempts: 3 }); }
  }
}
