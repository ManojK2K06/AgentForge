#!/bin/bash
cd /home/z/my-project
while true; do
  bun next dev -p 3000 >> /home/z/my-project/dev.log 2>&1
  echo "[watchdog] dev server exited, restarting in 3s..." >> /home/z/my-project/dev.log
  sleep 3
done
