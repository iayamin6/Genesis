# Background jobs

Bull queues and recurring jobs live in `api/src/jobs/` and share the API's Redis connection and domain models. The current API process also runs the workers and scheduler; there is no separate scheduler service. Splitting workers into an independently deployed process would require a dedicated entry point.

See [architecture](architecture.md) for the full service layout.
