#!/bin/bash
# Tue proprement le streamer + ses ffmpeg. Exécuté comme "bash wp-kill.sh" → pas de self-match pgrep.
for p in $(pgrep -f "[i]ndex\.mjs"); do kill -9 "$p" 2>/dev/null; done
for p in $(pgrep -f "[x]11grab"); do kill -9 "$p" 2>/dev/null; done
sleep 1
echo "remaining_index=$(pgrep -cf '[i]ndex\.mjs')"
echo "remaining_x11grab=$(pgrep -cf '[x]11grab')"
