import json
from datetime import datetime, timezone

def log(level: str, message: str, **fields):
    print(json.dumps({"timestamp": datetime.now(timezone.utc).isoformat(), "service": "ai-service", "level": level, "message": message, **fields}), flush=True)
