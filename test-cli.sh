#!/bin/bash

# Comprehensive test script for xswarm-ai-sanitize CLI

set -e

echo "=== xswarm-ai-sanitize CLI Test Suite ==="
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((TESTS_PASSED++))
}

fail() {
  echo -e "${RED}✗${NC} $1"
  ((TESTS_FAILED++))
}

info() {
  echo -e "${YELLOW}→${NC} $1"
}

# Test 1: Help output
info "Test 1: Help command"
if /usr/local/bin/node bin/cli.js --help | grep -q "xswarm-ai-sanitize"; then
  pass "Help command works"
else
  fail "Help command failed"
fi
echo

# Test 2: Anthropic key detection
info "Test 2: Anthropic API key detection"
OUTPUT=$(echo "KEY=sk-ant-abc123xyz789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456" | /usr/local/bin/node bin/cli.js -q)
if echo "$OUTPUT" | grep -q "\[REDACTED:anthropic_api_key\]"; then
  pass "Anthropic key detected and redacted"
else
  fail "Anthropic key not detected"
fi
echo

# Test 3: OpenAI key detection
info "Test 3: OpenAI API key detection"
OUTPUT=$(echo "KEY=sk-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGH" | /usr/local/bin/node bin/cli.js -q)
if echo "$OUTPUT" | grep -q "\[REDACTED:openai_api_key\]"; then
  pass "OpenAI key detected and redacted"
else
  fail "OpenAI key not detected"
fi
echo

# Test 4: AWS key detection
info "Test 4: AWS access key detection"
OUTPUT=$(echo "AWS_KEY=AKIAIOSFODNN7EXAMPLE" | /usr/local/bin/node bin/cli.js -q)
if echo "$OUTPUT" | grep -q "\[REDACTED:aws_access_key\]"; then
  pass "AWS key detected and redacted"
else
  fail "AWS key not detected"
fi
echo

# Test 5: GitHub token detection
info "Test 5: GitHub token detection"
OUTPUT=$(echo "TOKEN=ghp_1234567890abcdefghijklmnopqrstuv12345" | /usr/local/bin/node bin/cli.js -q)
if echo "$OUTPUT" | grep -q "\[REDACTED:github_pat\]"; then
  pass "GitHub token detected and redacted"
else
  fail "GitHub token not detected"
fi
echo

# Test 6: Safe content preservation
info "Test 6: Safe content preservation"
OUTPUT=$(echo "const DEBUG = true; const VERSION = '1.2.3';" | /usr/local/bin/node bin/cli.js -q)
if echo "$OUTPUT" | grep -q "const DEBUG = true"; then
  pass "Safe content preserved"
else
  fail "Safe content was incorrectly modified"
fi
echo

# Test 7: Block mode with secrets
info "Test 7: Block mode (should exit 1 with secrets)"
if echo "KEY=sk-ant-abc123xyz789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456" | /usr/local/bin/node bin/cli.js --block --secrets 1 -q 2>/dev/null; then
  fail "Block mode should exit 1 with secrets"
else
  pass "Block mode correctly exits 1"
fi
echo

# Test 8: Block mode without secrets
info "Test 8: Block mode (should exit 0 without secrets)"
if echo "const DEBUG = true;" | /usr/local/bin/node bin/cli.js --block --secrets 1 -q 2>/dev/null; then
  pass "Block mode correctly exits 0 without secrets"
else
  fail "Block mode should exit 0 with clean content"
fi
echo

# Test 9: File input
info "Test 9: File input"
echo "API_KEY=sk-ant-abc123xyz789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456" > /tmp/test-cli-input.txt
OUTPUT=$(/usr/local/bin/node bin/cli.js -q /tmp/test-cli-input.txt)
if echo "$OUTPUT" | grep -q "\[REDACTED:anthropic_api_key\]"; then
  pass "File input works"
  rm /tmp/test-cli-input.txt
else
  fail "File input failed"
fi
echo

# Test 10: Multiple secrets
info "Test 10: Multiple secrets detection"
cat > /tmp/test-multi.txt <<'EOF'
ANTHROPIC_KEY=sk-ant-abc123xyz789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456
AWS_KEY=AKIAIOSFODNN7EXAMPLE
GITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuv12345
EOF
OUTPUT=$(/usr/local/bin/node bin/cli.js /tmp/test-multi.txt 2>&1)
SECRET_COUNT=$(echo "$OUTPUT" | grep -o "[0-9]\+ secret(s) redacted" | grep -o "[0-9]\+")
if [ "$SECRET_COUNT" -ge 3 ]; then
  pass "Multiple secrets detected ($SECRET_COUNT found)"
  rm /tmp/test-multi.txt
else
  fail "Not all secrets detected (expected 3+, found $SECRET_COUNT)"
fi
echo

# Test 11: Stdin piping
info "Test 11: Stdin piping"
OUTPUT=$(echo "KEY=sk-ant-abc123xyz789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456" | /usr/local/bin/node bin/cli.js -q)
if echo "$OUTPUT" | grep -q "\[REDACTED:anthropic_api_key\]"; then
  pass "Stdin piping works"
else
  fail "Stdin piping failed"
fi
echo

# Test 12: Quiet mode (no stats)
info "Test 12: Quiet mode output"
OUTPUT=$(echo "KEY=sk-ant-abc123xyz789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456" | /usr/local/bin/node bin/cli.js -q 2>&1)
if echo "$OUTPUT" | grep -q "secret(s) redacted"; then
  fail "Quiet mode should not output stats"
else
  pass "Quiet mode suppresses stats"
fi
echo

# Summary
echo "==================================="
echo "Test Results:"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
  echo -e "${RED}Failed: $TESTS_FAILED${NC}"
  echo
  echo "Some tests failed. Please review the output above."
  exit 1
else
  echo -e "${GREEN}All tests passed!${NC}"
  echo
  echo "✓ CLI is working correctly"
  echo "✓ Secret detection operational"
  echo "✓ Block mode functional"
  echo "✓ Ready for use with npx"
  exit 0
fi
