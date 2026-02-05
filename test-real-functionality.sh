#!/bin/bash

# Real-world functional tests - NO MOCKS
# Don't exit on error - we want to see all test results
set +e

echo "======================================"
echo "Real-World Functional Test Suite"
echo "======================================"
echo

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

CLI="/usr/local/bin/node bin/cli.js"
PASS=0
FAIL=0

test_case() {
  echo -e "${BLUE}→${NC} $1"
}

pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((PASS++))
}

fail() {
  echo -e "${RED}✗${NC} $1"
  ((FAIL++))
}

# Test 1: Anthropic key detection
test_case "Test 1: Anthropic API key detection"
RESULT=$(echo "KEY=sk-ant-$(printf 'a%.0s' {1..100})" | $CLI -q)
if echo "$RESULT" | grep -q "\[REDACTED:anthropic_api_key\]"; then
  pass "Anthropic key detected and redacted"
else
  fail "Anthropic key NOT detected"
fi
echo

# Test 2: OpenAI key detection
test_case "Test 2: OpenAI API key detection"
RESULT=$(echo "KEY=sk-$(printf 'a%.0s' {1..45})" | $CLI -q)
if echo "$RESULT" | grep -q "\[REDACTED:openai_api_key\]"; then
  pass "OpenAI key detected and redacted"
else
  fail "OpenAI key NOT detected"
fi
echo

# Test 3: OpenAI org key detection
test_case "Test 3: OpenAI org key detection"
RESULT=$(echo "KEY=sk-org-$(printf 'a%.0s' {1..45})" | $CLI -q)
if echo "$RESULT" | grep -q "\[REDACTED:openai_org_key\]"; then
  pass "OpenAI org key detected and redacted"
else
  fail "OpenAI org key NOT detected"
fi
echo

# Test 4: AWS key detection
test_case "Test 4: AWS access key detection"
RESULT=$(echo "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE" | $CLI -q)
if echo "$RESULT" | grep -q "\[REDACTED:aws_access_key\]"; then
  pass "AWS key detected and redacted"
else
  fail "AWS key NOT detected"
fi
echo

# Test 5: GitHub token detection
test_case "Test 5: GitHub token detection"
RESULT=$(echo "TOKEN=ghp_$(printf 'a%.0s' {1..36})" | $CLI -q)
if echo "$RESULT" | grep -q "\[REDACTED:github_pat\]"; then
  pass "GitHub token detected and redacted"
else
  fail "GitHub token NOT detected"
fi
echo

# Test 6: Multiple secrets in one file
test_case "Test 6: Multiple secrets detection"
cat > /tmp/test-multi.txt <<EOF
ANTHROPIC=sk-ant-$(printf 'a%.0s' {1..100})
AWS=AKIAIOSFODNN7EXAMPLE
GITHUB=ghp_$(printf 'a%.0s' {1..36})
DEBUG=true
EOF
RESULT=$($CLI -q /tmp/test-multi.txt)
REDACTED_COUNT=$(echo "$RESULT" | grep -o "\[REDACTED:" | wc -l | tr -d ' ')
if [ "$REDACTED_COUNT" -ge 3 ]; then
  pass "Multiple secrets detected ($REDACTED_COUNT found)"
else
  fail "Not all secrets detected (expected 3+, got $REDACTED_COUNT)"
fi
rm -f /tmp/test-multi.txt
echo

# Test 7: Safe content preservation
test_case "Test 7: Safe content preservation"
RESULT=$(echo "const DEBUG = true; const VERSION = '1.2.3';" | $CLI -q)
if echo "$RESULT" | grep -q "const DEBUG = true" && echo "$RESULT" | grep -q "const VERSION"; then
  pass "Safe content preserved"
else
  fail "Safe content was modified"
fi
echo

# Test 8: Block mode with secrets
test_case "Test 8: Block mode (should exit 1 with secrets)"
echo "KEY=sk-ant-$(printf 'a%.0s' {1..100})" | $CLI --block --secrets 1 -q 2>/dev/null
EXIT_CODE=$?
if [ $EXIT_CODE -eq 1 ]; then
  pass "Block mode correctly exits 1 with secrets"
else
  fail "Block mode should exit 1 (got $EXIT_CODE)"
fi
echo

# Test 9: Block mode without secrets
test_case "Test 9: Block mode (should exit 0 without secrets)"
echo "const DEBUG = true;" | $CLI --block --secrets 1 -q 2>/dev/null
EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
  pass "Block mode correctly exits 0 without secrets"
else
  fail "Block mode should exit 0 (got $EXIT_CODE)"
fi
echo

# Test 10: Stdin input
test_case "Test 10: Stdin piping"
RESULT=$(echo "KEY=sk-ant-$(printf 'a%.0s' {1..100})" | $CLI -q)
if echo "$RESULT" | grep -q "\[REDACTED:anthropic_api_key\]"; then
  pass "Stdin piping works"
else
  fail "Stdin piping failed"
fi
echo

# Test 11: File input
test_case "Test 11: File input"
echo "KEY=sk-ant-$(printf 'a%.0s' {1..100})" > /tmp/test-file.txt
RESULT=$($CLI -q /tmp/test-file.txt)
if echo "$RESULT" | grep -q "\[REDACTED:anthropic_api_key\]"; then
  pass "File input works"
else
  fail "File input failed"
fi
rm -f /tmp/test-file.txt
echo

# Test 12: Help command
test_case "Test 12: Help command"
RESULT=$($CLI --help)
if echo "$RESULT" | grep -q "xswarm-ai-sanitize"; then
  pass "Help command works"
else
  fail "Help command failed"
fi
echo

# Test 13: Database URLs
test_case "Test 13: Database URL detection"
RESULT=$(echo "DB=postgres://user:pass@localhost/db" | $CLI -q)
if echo "$RESULT" | grep -q "REDACTED"; then
  pass "Database URL detected"
else
  fail "Database URL NOT detected"
fi
echo

# Test 14: Stripe keys
test_case "Test 14: Stripe key detection"
RESULT=$(echo "STRIPE=sk_live_$(printf 'a%.0s' {1..24})" | $CLI -q)
if echo "$RESULT" | grep -q "\[REDACTED:stripe_live_key\]"; then
  pass "Stripe key detected"
else
  fail "Stripe key NOT detected"
fi
echo

# Test 15: No false positives on safe content
test_case "Test 15: No false positives"
RESULT=$(echo "const API_VERSION = 'v1'; const MAX_RETRIES = 5;" | $CLI -q)
if echo "$RESULT" | grep -q "API_VERSION.*v1" && ! echo "$RESULT" | grep -q "REDACTED"; then
  pass "No false positives on safe content"
else
  fail "False positive detected"
fi
echo

echo "======================================"
echo "Summary:"
echo -e "${GREEN}Passed: $PASS${NC}"
if [ $FAIL -gt 0 ]; then
  echo -e "${RED}Failed: $FAIL${NC}"
  echo "Some tests failed. Review output above."
  exit 1
else
  echo "All tests passed!"
  exit 0
fi
