import { Alert } from '../models.js';

export async function createAlert(io, attributes) {
  try {
    const alert = await Alert.create(attributes);
    io.to(`workspace:${alert.workspaceId}`).emit('alert:created', alert.toJSON());
    return alert;
  } catch (error) {
    if (error.code === 11000) return null; // idempotent job retry / repeated scheduler tick
    throw error;
  }
}
