# Scheduler

The scheduler deliberately lives in `api/src/jobs/scheduler.js`. Bull repeatable jobs need the same Redis connection and domain models as the API; this keeps it independently scalable as a worker process without creating a needless fifth service.
