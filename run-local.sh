#!/usr/bin/env bash

# Run this script from the project folder to start the local server.
# Then open http://localhost:8080 in your browser.

cd "$(dirname "$0")"

if command -v npm >/dev/null 2>&1; then
  npm start
else
  node server.js
fi
