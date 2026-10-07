import Queue from 'bull';
import axios from 'axios';
import { AgentRun, Workspace } from '../models.js';
import { log } from '../logger.js';
import { dispatchDaily, dispatchCompany } from './scheduler.js';
import { storeRunArtifact } from '../storage.js';

let agentQueue;

try {
  if (process.env.REDIS_URL || !process.env.VERCEL)
    agentQueue = new Queue('agent-runs', process.env.REDIS_URL || 'redis://localhost:6379', {
      redis: { connectTimeout: 3000, maxRetriesPerRequest: 1 },
    });
  if (agentQueue && !process.env.VERCEL && process.env.WORKER_ENABLED !== 'false')
    agentQueue.process(3, async (job) => {
      if (job.data.type === 'company-dispatch') return dispatchCompany();
      if (job.data.type === 'daily-dispatch') return dispatchDaily();
      const run = await AgentRun.findById(job.data.runId);
      if (!run || ['completed', 'partial'].includes(run.status)) return { skipped: true };
      const workspace = await Workspace.findById(run.workspaceId);
      if (!workspace) throw new Error('Workspace missing for run');
      try {
        const response = await axios.post(
          `${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/runs/${run.id}`,
          {
            runId: run.id,
            kind: run.kind,
            idea: workspace.idea,
            industry: workspace.industry || '',
            competitors: workspace.competitors.map((c) => ({
              id: c._id.toString(),
              name: c.name,
              url: c.url,
              lastSnapshot: c.lastSnapshot,
            })),
          },
          {
            timeout: 185000,
            headers: { 'X-Internal-Token': process.env.INTERNAL_API_TOKEN || '' },
          },
        );
        const artifact = await storeRunArtifact(run.id, response.data);
        if (artifact) await AgentRun.findByIdAndUpdate(run.id, { $push: { artifacts: artifact } });
        return response.data;
      } catch (error) {
        log('api', 'error', 'agent_queue_job_failed', { runId: run.id, error: error.message });
        throw error;
      }
    });

  agentQueue?.on('failed', async (job, error) => {
    if (job.data.runId && job.attemptsMade >= (job.opts.attempts || 1)) {
      await AgentRun.findByIdAndUpdate(job.data.runId, { status: 'failed', error: error.message });
    }
  });

  // Authentication and workspace CRUD stay online if the background queue is temporarily unavailable.
  agentQueue?.on('error', (error) =>
    log('api', 'warn', 'redis_unavailable', { error: error.message }),
  );
} catch (error) {
  log('api', 'warn', 'queue_init_failed', { error: error.message });
  agentQueue = null;
}

export async function enqueueRun(run) {
  await requireQueue();
  return agentQueue.add(
    { runId: run.id },
    {
      jobId: run.id,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  );
}

export { agentQueue };

export async function requireQueue() {
  let timer;
  try {
    if (!agentQueue) throw Error('No queue configured');
    await Promise.race([
      agentQueue.isReady().then(() => agentQueue.client.ping()),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('Queue timeout')), 2500);
      }),
    ]);
  } catch {
    throw Object.assign(
      Error(
        'Background analysis is not available yet. Your saved account and company data remain available.',
      ),
      { status: 503 },
    );
  } finally {
    clearTimeout(timer);
  }
}
