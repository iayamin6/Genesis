import { Router } from 'express';
import { z } from 'zod';
import { FinancialSnapshot, Workspace } from '../models.js';
import { requireAuth, workspaceRole } from '../auth.js';
import { calculateRunway, detectBurnAnomaly, forecastScenarios } from '../services/runway.js';
import { createAlert } from '../services/alerts.js';

export function financialRouter(io) {
  const router = Router(); router.use(requireAuth);
  router.post('/workspaces/:workspaceId/financials', async (req, res, next) => { try {
    const workspace = await Workspace.findById(req.params.workspaceId); if (!workspace || !workspaceRole(workspace, req.user._id)) return res.status(404).json({ error: 'Workspace not found' }); if (req.method !== 'GET' && workspaceRole(workspace, req.user._id) === 'viewer') return res.status(403).json({ error: 'Viewer access is read-only' });
    const data = z.object({ currency: z.enum(['USD', 'EUR', 'GBP', 'BDT', 'CAD', 'AUD', 'INR']).optional(), cash: z.number().nonnegative(), monthlyRevenue: z.number().nonnegative().default(0), monthlyExpenses: z.number().nonnegative() }).parse(req.body);
    const snapshot = await FinancialSnapshot.create({ workspaceId: workspace._id, ...data }); const runway = calculateRunway(data);
    const history = await FinancialSnapshot.find({ workspaceId: workspace._id }).sort({ recordedAt: -1 }).limit(6); const anomaly = detectBurnAnomaly(history);
    if (runway.runwayMonths !== null && runway.runwayMonths <= 6) await createAlert(io, { workspaceId: workspace._id, dedupeKey: `runway:${workspace.id}:${snapshot.id}:${Math.ceil(runway.runwayMonths)}`, category: 'runway', severity: runway.runwayMonths <= 3 ? 'critical' : 'warning', title: `${runway.runwayMonths} months of runway remaining`, body: 'Review burn, revenue, and financing scenarios now.', metadata: runway });
    if (anomaly.anomalous) await createAlert(io, { workspaceId: workspace._id, dedupeKey: `burn-anomaly:${workspace.id}:${snapshot.id}`, category: 'burn_rate', severity: 'warning', title: 'Burn rate increased materially', body: `Net burn is ${(anomaly.change * 100).toFixed(0)}% above its recent baseline.`, metadata: anomaly });
    res.status(201).json({ snapshot, runway, anomaly });
  } catch (error) { next(error); } });
  router.get('/workspaces/:workspaceId/financials/latest', async (req, res) => { const workspace = await Workspace.findById(req.params.workspaceId); if (!workspace || !workspaceRole(workspace, req.user._id)) return res.status(404).json({ error: 'Workspace not found' }); if (req.method !== 'GET' && workspaceRole(workspace, req.user._id) === 'viewer') return res.status(403).json({ error: 'Viewer access is read-only' }); const snapshot = await FinancialSnapshot.findOne({ workspaceId: workspace._id }).sort({ recordedAt: -1 }); res.json(snapshot ? { snapshot, runway: calculateRunway(snapshot) } : null); });
  router.post('/workspaces/:workspaceId/financials/scenarios', async (req, res, next) => { try { const workspace = await Workspace.findById(req.params.workspaceId); if (!workspace || !workspaceRole(workspace, req.user._id)) return res.status(404).json({ error: 'Workspace not found' }); if (req.method !== 'GET' && workspaceRole(workspace, req.user._id) === 'viewer') return res.status(403).json({ error: 'Viewer access is read-only' }); const scenarios = z.array(z.object({ name: z.string().min(1), cashDelta: z.number().default(0), revenueDelta: z.number().default(0), expenseDelta: z.number().default(0) })).max(10).parse(req.body); const latest = await FinancialSnapshot.findOne({ workspaceId: workspace._id }).sort({ recordedAt: -1 }); if (!latest) return res.status(400).json({ error: 'Enter a financial snapshot first' }); res.json(forecastScenarios(latest, scenarios)); } catch (error) { next(error); } });
  return router;
}
