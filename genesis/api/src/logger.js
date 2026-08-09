export function log(service, level, message, fields = {}) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), service, level, message, ...fields }));
}
