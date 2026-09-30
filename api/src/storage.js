import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { log } from './logger.js';

const bucket = process.env.MINIO_BUCKET || 'genesis-artifacts';
const client = new S3Client({
  endpoint: `http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || 9000}`,
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  },
});
let initialized = false;
async function ensureBucket() {
  if (initialized) return;
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
  initialized = true;
}
export async function storeRunArtifact(runId, report) {
  try {
    await ensureBucket();
    const key = `runs/${runId}/report.json`;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: JSON.stringify(report, null, 2),
        ContentType: 'application/json',
      }),
    );
    return { key, bucket, contentType: 'application/json' };
  } catch (error) {
    log('api', 'warn', 'artifact_store_failed', { runId, error: error.message });
    return null;
  }
}
