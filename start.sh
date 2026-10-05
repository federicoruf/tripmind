#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

mintty -t "Backend" -e bash -c "cd '$SCRIPT_DIR/backend' && npm run dev; exec bash" &

mintty -t "Frontend" -e bash -c "cd '$SCRIPT_DIR/frontend' && npm run dev; exec bash" &