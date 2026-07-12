#!/bin/bash
cd /home/z/my-project

# Start logs-service in background
cd /home/z/my-project/mini-services/logs-service
bun index.ts >> /home/z/my-project/logs-service.log 2>&1 &
LOGS_PID=$!
echo "[start-all] logs-service PID: $LOGS_PID"

# Start dev server in foreground (will restart if it dies via the outer loop)
cd /home/z/my-project
exec bun next dev -p 3000 2>&1 | tee -a /home/z/my-project/dev.log
