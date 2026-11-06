#!/bin/bash
# Double-click this file to start the dev server and open the app in your browser.
# Closing the Terminal window will stop the server.

set -e
cd "$(dirname "$0")"

# Open the browser shortly after the dev server starts.
( sleep 2; open http://localhost:3000 ) &

exec npm run dev
