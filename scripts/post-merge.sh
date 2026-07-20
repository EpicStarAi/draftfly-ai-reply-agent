#!/bin/bash
set -e

push_to_github() {
  if [ -n "$GITHUB_TOKEN" ]; then
    local remote="https://EpicStarAi:${GITHUB_TOKEN}@github.com/EpicStarAi/draftfly-ai-reply-agent.git"
    if git remote get-url github >/dev/null 2>&1; then
      git remote set-url github "$remote"
    else
      git remote add github "$remote"
    fi
    git push --force github HEAD:main \
      || echo "Warning: GitHub mirror push failed (non-fatal)"
  fi
}
trap push_to_github EXIT

pnpm install --frozen-lockfile
pnpm --filter db push
