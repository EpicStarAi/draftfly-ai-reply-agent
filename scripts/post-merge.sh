#!/bin/bash

FAILED_STEPS=()

pnpm install --frozen-lockfile \
  || FAILED_STEPS+=("pnpm install")

pnpm --filter db push \
  || FAILED_STEPS+=("db push")

if [ ${#FAILED_STEPS[@]} -gt 0 ]; then
  echo "Warning: the following setup steps failed: ${FAILED_STEPS[*]}"
  echo "GitHub mirror will still be updated."
fi

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
push_to_github
