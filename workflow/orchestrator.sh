#!/bin/bash
#
# Main Workflow Orchestrator Wrapper
# Delegates to the actual orchestrator in the scripts directory
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Forward all arguments to the actual orchestrator script
exec "$SCRIPT_DIR/scripts/orchestrator.sh" "$@"