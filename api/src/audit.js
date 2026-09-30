import mongoose from 'mongoose';
const AuditRecord = mongoose.model(
  'AuditRecord',
  new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    workspaceId: mongoose.Schema.Types.ObjectId,
    method: String,
    path: String,
    status: Number,
    createdAt: { type: Date, default: Date.now, expires: 31536000 },
  }),
);
export function auditWrites(req, res, next) {
  res.on('finish', () => {
    if (req.method === 'GET' || !req.user || res.statusCode >= 400) return;
    AuditRecord.create({
      userId: req.user._id,
      workspaceId: req.companyId,
      method: req.method,
      path: req.originalUrl.split('?')[0].slice(0, 300),
      status: res.statusCode,
    }).catch(() => {});
  });
  next();
}
