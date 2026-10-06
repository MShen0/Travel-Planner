#!/bin/bash
# Cloud sessions start from a fresh container: install what the agent skills and tests need.
# faster-whisper (speech-to-text) stays optional because its model download is large.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"
pip install --quiet --disable-pip-version-check -r tools/requirements.txt pytest
