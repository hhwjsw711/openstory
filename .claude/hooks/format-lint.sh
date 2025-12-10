#!/bin/bash

# Hook to format and lint files after Write/Edit operations
file_path=$(jq -r '.tool_input.file_path')

if [[ "$file_path" =~ \.(ts|tsx|js|jsx)$ ]]; then
  bunx oxfmt "$file_path"
  bunx oxlint --fix "$file_path"
fi
