#!/bin/bash
# Bypass Budget Ratchet
# Ensures eslint-disable comment counts only go DOWN, never UP.
# Compares current codebase counts against .eslint-bypass-budget.json
# Uses Node.js for cross-platform compatibility (grep --include fails on Windows)

node scripts/check-bypass-budget.js
