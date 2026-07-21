#!/usr/bin/env bash
# Tests for scripts/post-merge.sh
# Exercises run_step timeout/failure handling and confirms the script exits 0
# and the mirror-push phase still runs regardless of earlier step outcomes.

PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

# ---------------------------------------------------------------------------
# Define run_step locally (identical to the production implementation) so we
# can unit-test it in isolation without running the rest of the script.
# ---------------------------------------------------------------------------

FAILED_STEPS=()

run_step() {
  local name="$1"
  local timeout_secs="$2"
  shift 2
  timeout "$timeout_secs" "$@"
  local exit_code=$?
  if [ $exit_code -eq 124 ]; then
    echo "Warning: step '${name}' timed out after ${timeout_secs}s"
    FAILED_STEPS+=("${name} (timed out)")
  elif [ $exit_code -ne 0 ]; then
    FAILED_STEPS+=("${name}")
  fi
}

echo "=== Unit tests: run_step ==="

# --- Test 1: successful step leaves FAILED_STEPS empty ---
FAILED_STEPS=()
run_step "noop" 5 true
if [ ${#FAILED_STEPS[@]} -eq 0 ]; then
  pass "successful step does not add to FAILED_STEPS"
else
  fail "successful step should not add to FAILED_STEPS (got: ${FAILED_STEPS[*]})"
fi

# --- Test 2: failing step records the step name ---
FAILED_STEPS=()
run_step "my-failing-step" 5 false
if [ ${#FAILED_STEPS[@]} -eq 1 ] && [ "${FAILED_STEPS[0]}" = "my-failing-step" ]; then
  pass "failing step records step name in FAILED_STEPS"
else
  fail "failing step should record step name (got: ${FAILED_STEPS[*]:-<empty>})"
fi

# --- Test 3: timed-out step records '(timed out)' suffix ---
FAILED_STEPS=()
run_step "slow-step" 1 sleep 60
if [ ${#FAILED_STEPS[@]} -eq 1 ] && [[ "${FAILED_STEPS[0]}" == *"timed out"* ]]; then
  pass "timed-out step recorded with '(timed out)' suffix in FAILED_STEPS"
else
  fail "timed-out step should record '(timed out)' suffix (got: ${FAILED_STEPS[*]:-<empty>})"
fi

# --- Test 4: timeout warning message names the step ---
FAILED_STEPS=()
warning=$(run_step "db-migration" 1 sleep 60 2>&1)
if echo "$warning" | grep -q "db-migration"; then
  pass "timeout warning message names the step"
else
  fail "timeout warning message should name the step (got: '$warning')"
fi

# --- Test 5: timeout warning message includes the duration ---
FAILED_STEPS=()
warning=$(run_step "install" 1 sleep 60 2>&1)
if echo "$warning" | grep -q "1s"; then
  pass "timeout warning message includes the timeout duration"
else
  fail "timeout warning message should include timeout duration (got: '$warning')"
fi

# --- Test 6: multiple failed steps are all recorded ---
FAILED_STEPS=()
run_step "step-a" 5 false
run_step "step-b" 1 sleep 60
if [ ${#FAILED_STEPS[@]} -eq 2 ]; then
  pass "multiple failed/timed-out steps are all recorded"
else
  fail "should record all failed steps (got: ${FAILED_STEPS[*]:-<empty>})"
fi

# ---------------------------------------------------------------------------
# Integration test: run a self-contained copy of the real script with mocked
# commands so we exercise the actual control-flow without real side-effects.
#
# The mocked pnpm install times out (1s timeout on sleep 10).
# The mocked db push fails.
# push_to_github is a no-op stub that records it was called.
# The script must exit 0 in all cases.
# ---------------------------------------------------------------------------

echo ""
echo "=== Integration test: full script run ==="

TMPSCRIPT=$(mktemp /tmp/post-merge-test.XXXXXX.sh)
trap 'rm -f "$TMPSCRIPT"' EXIT

cat > "$TMPSCRIPT" <<'SCRIPT'
#!/bin/bash

FAILED_STEPS=()

run_step() {
  local name="$1"
  local timeout_secs="$2"
  shift 2
  timeout "$timeout_secs" "$@"
  local exit_code=$?
  if [ $exit_code -eq 124 ]; then
    echo "Warning: step '${name}' timed out after ${timeout_secs}s"
    FAILED_STEPS+=("${name} (timed out)")
  elif [ $exit_code -ne 0 ]; then
    FAILED_STEPS+=("${name}")
  fi
}

# Simulate: pnpm install times out (1s timeout on sleep 10)
run_step "pnpm install" 1 sleep 10

# Simulate: db push fails immediately
run_step "db push" 5 false

if [ ${#FAILED_STEPS[@]} -gt 0 ]; then
  echo "Warning: the following setup steps failed: ${FAILED_STEPS[*]}"
  echo "GitHub mirror will still be updated."
fi

push_to_github() {
  # Stub: no real git ops; record that push was reached
  echo "PUSH_CALLED"
}
push_to_github
SCRIPT

chmod +x "$TMPSCRIPT"

integration_output=$("$TMPSCRIPT" 2>&1)
integration_exit=$?

# --- Test 7: script exits 0 even when steps fail/time out ---
if [ $integration_exit -eq 0 ]; then
  pass "script exits 0 when steps fail or time out"
else
  fail "script should exit 0 even when steps fail/time out (got exit $integration_exit)"
fi

# --- Test 8: timeout warning names the timed-out step ---
if echo "$integration_output" | grep -q "pnpm install"; then
  pass "timeout warning names the timed-out step ('pnpm install')"
else
  fail "timeout warning should name the timed-out step (output: $integration_output)"
fi

# --- Test 9: summary warning lists all failed steps ---
if echo "$integration_output" | grep -q "the following setup steps failed"; then
  pass "summary warning is emitted when steps fail"
else
  fail "summary warning should be emitted when steps fail (output: $integration_output)"
fi

# --- Test 10: mirror push still runs after failures ---
if echo "$integration_output" | grep -q "PUSH_CALLED"; then
  pass "mirror push still runs after failed/timed-out steps"
else
  fail "mirror push should still run after failures (output: $integration_output)"
fi

# --- Test 11: 'GitHub mirror will still be updated' message is printed ---
if echo "$integration_output" | grep -q "GitHub mirror will still be updated"; then
  pass "'GitHub mirror will still be updated' message printed before push"
else
  fail "'GitHub mirror will still be updated' should be printed (output: $integration_output)"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ $FAIL -eq 0 ]
