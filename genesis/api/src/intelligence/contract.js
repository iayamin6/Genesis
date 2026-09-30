import { z } from 'zod';
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const name = z.string().trim().min(1).max(160);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Invalid calendar date');
const count = z.number().int().nonnegative().max(1000000);
const hours = z.number().finite().nonnegative().max(10000);
const entity = { id, name };
export const snapshotSchema = z.object({
  importKey: id,
  observedAt: z.string().datetime(),
  domainsObservedAt: z.object({ customers: z.string().datetime(), capacity: z.string().datetime(), delivery: z.string().datetime() }).strict().optional(),
  source: z.object({ kind: z.enum(['manual', 'sample', 'connector']), name }).strict(),
  currency: z.enum(['USD', 'EUR', 'GBP', 'BDT', 'CAD', 'AUD', 'INR']),
  teams: z.array(z.object(entity).strict()).max(100),
  employees: z.array(z.object({ ...entity, teamId: id, capacityHours: hours, allocatedHours: hours }).strict()).max(500),
  projects: z.array(z.object({ ...entity, teamId: id, ownerIds: z.array(id).max(100), dueDate: date, completion: z.number().min(0).max(100) }).strict()).max(300),
  products: z.array(z.object(entity).strict()).max(100),
  features: z.array(z.object({ ...entity, projectId: id, productId: id }).strict()).max(500),
  customers: z.array(z.object({ ...entity, featureIds: z.array(id).max(100), requestedFeatureIds: z.array(id).max(100).optional(), arrMinor: z.number().int().nonnegative().max(1e12), renewalDate: date.optional(), accountManagerId: id.optional(), segment: z.string().trim().max(100).optional(), activeUsers: count.optional(), usageWindowDays: z.number().int().min(1).max(365).optional(), paymentOverdueDays: count.optional(), outstandingAmountMinor: z.number().int().min(0).max(1e12).optional(), oldestSupportIssueDays: count.optional(), pricingConcern: z.string().trim().max(2000).optional(), openSupportIssues: count }).strict()).max(1000),
}).strict().superRefine((data, ctx) => {
  const issue = (path, message) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  if (data.domainsObservedAt) for (const [domain, stamp] of Object.entries(data.domainsObservedAt)) if (Date.parse(stamp) > Date.parse(data.observedAt)) issue(['domainsObservedAt', domain], 'Domain timestamp cannot be newer than observation');
  for (const key of ['teams', 'employees', 'projects', 'products', 'features', 'customers']) {
    const seen = new Set();
    data[key].forEach((e, i) => { if (seen.has(e.id)) issue([key, i, 'id'], 'Duplicate ID'); seen.add(e.id); });
  }
  const ids = key => new Set(data[key].map(e => e.id));
  const teams = ids('teams'), employees = ids('employees'), projects = ids('projects'), products = ids('products'), features = ids('features');
  data.employees.forEach((e, i) => { if (!teams.has(e.teamId)) issue(['employees', i, 'teamId'], 'Unknown team'); });
  data.projects.forEach((p, i) => {
    if (!teams.has(p.teamId)) issue(['projects', i, 'teamId'], 'Unknown team');
    if (new Set(p.ownerIds).size !== p.ownerIds.length) issue(['projects', i, 'ownerIds'], 'Duplicate owner');
    p.ownerIds.forEach(owner => { if (!employees.has(owner) || data.employees.find(e => e.id === owner)?.teamId !== p.teamId) issue(['projects', i, 'ownerIds'], 'Owner must belong to project team'); });
  });
  data.features.forEach((f, i) => { if (!projects.has(f.projectId)) issue(['features', i, 'projectId'], 'Unknown project'); if (!products.has(f.productId)) issue(['features', i, 'productId'], 'Unknown product'); });
  data.customers.forEach((c, i) => { if (c.accountManagerId && !employees.has(c.accountManagerId)) issue(['customers', i, 'accountManagerId'], 'Unknown account owner'); if ((c.activeUsers === undefined) !== (c.usageWindowDays === undefined)) issue(['customers', i, 'activeUsers'], 'Active users and measurement window must be supplied together'); const requested = c.requestedFeatureIds || []; if (new Set(requested).size !== requested.length || requested.some(f => !features.has(f))) issue(['customers', i, 'requestedFeatureIds'], 'Requests must reference unique existing features'); if (new Set(c.featureIds).size !== c.featureIds.length) issue(['customers', i, 'featureIds'], 'Duplicate feature'); c.featureIds.forEach(f => { if (!features.has(f)) issue(['customers', i, 'featureIds'], 'Unknown feature'); }); });
});
export const actionSchema = z.object({ riskKey: z.string().min(1).max(180), title: name, ownerId: id, dueDate: date, reason: z.string().trim().min(1).max(2000), expectedResult: z.string().trim().min(1).max(2000) }).strict();
export const actionUpdateSchema = z.object({ status: z.enum(['open', 'in_progress', 'completed', 'cancelled']) }).strict();
