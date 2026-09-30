import mongoose from 'mongoose';
import { z } from 'zod';
const { Schema, model } = mongoose;
export const MarketObservation = model(
  'MarketObservation',
  new Schema(
    {
      workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
      competitorId: String,
      competitorName: String,
      changeType: String,
      description: String,
      sourceUrl: String,
      observedAt: Date,
      segments: [String],
      customerIds: [String],
      createdBy: Schema.Types.ObjectId,
    },
    { timestamps: true },
  ),
);
export const marketInput = z
  .object({
    competitorId: z.string().regex(/^[a-f\d]{24}$/i),
    changeType: z.enum(['pricing', 'feature', 'positioning']),
    description: z.string().trim().min(10).max(3000),
    sourceUrl: z
      .string()
      .url()
      .refine((v) => ['http:', 'https:'].includes(new URL(v).protocol)),
    observedAt: z.string().datetime(),
    segments: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
    customerIds: z.array(z.string().min(1).max(80)).max(1000).default([]),
  })
  .strict();
export function marketSignals(snapshot, observations, evaluatedAt) {
  return observations
    .filter((o) => Date.parse(evaluatedAt) - new Date(o.observedAt).getTime() <= 90 * 86400000)
    .flatMap((o) => {
      const customers = snapshot.customers.filter(
        (c) =>
          o.customerIds.includes(c.id) ||
          (c.segment && o.segments.some((s) => s.toLowerCase() === c.segment.toLowerCase())),
      );
      if (!customers.length) return [];
      return [
        {
          key: `market:${o._id}`,
          category: 'market_change',
          severity: 'warning',
          title: `${o.competitorName}: ${o.changeType} change overlaps ${customers.length} accounts`,
          explanation: o.description,
          consequence:
            'Overlap is based on selected accounts or matching recorded segments. It does not prove customer intent to switch or quantify expected loss.',
          confidence:
            'user-recorded market observation; source link retained, not independently verified',
          sourceUrl: o.sourceUrl,
          observedAt: o.observedAt,
          evidence: {
            currency: snapshot.currency,
            customerCount: customers.length,
            arrMinor: customers.reduce((n, c) => n + c.arrMinor, 0),
            supportIssues: customers.reduce((n, c) => n + c.openSupportIssues, 0),
            pricingConcerns: customers.filter((c) => c.pricingConcern).length,
          },
          customers,
          paths: [],
          recommendations: [
            'Review affected accounts and their recorded pricing concerns',
            'Verify the source and assess differentiation before changing pricing',
          ],
        },
      ];
    });
}
