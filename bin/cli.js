#!/usr/bin/env node

/**
 * xswarm-ai-sanitize CLI
 * Command-line tool for detecting and redacting secrets/credentials
 */

import { readFileSync } from 'fs';
import { stdin as stdinStream } from 'process';
import sanitize from '../src/index.js';
import { patternCount } from '../src/detectors.js';

const HELP_TEXT = `
xswarm-ai-sanitize - Regex secret detection & redaction

Usage:
  xswarm-ai-sanitize [options] [file]
  cat file.txt | xswarm-ai-sanitize [options]

Options:
  -m, --mode <mode>           Mode: 'sanitize' (default) or 'block'
  -b, --block                 Enable block mode (reject if secrets found)
  -s, --secrets <n>           Block threshold for secrets (default: 3)
  -h, --high-severity <n>     Block threshold for high-severity threats (default: 1)
  -q, --quiet                 Suppress statistics output
  -v, --verbose               Show detailed threat information
  --help                      Show this help message

Examples:
  # Sanitize a file (redact secrets)
  xswarm-ai-sanitize config.yml

  # Read from stdin
  cat .env | xswarm-ai-sanitize

  # Block mode (exit 1 if secrets detected)
  xswarm-ai-sanitize --block --secrets 1 production.log

  # Quiet mode (only output sanitized content)
  xswarm-ai-sanitize -q < input.txt > output.txt

Detection:
  - ${patternCount} secret regex patterns + Shannon entropy analysis
  - Zero dependencies, zero external API calls
  - <5ms processing time for typical documents
`;

// Parse command-line arguments
function parseArgs(argv) {
  const args = {
    mode: 'sanitize',
    blockThreshold: {
      secrets: 3,
      highSeverity: 1
    },
    quiet: false,
    verbose: false,
    file: null
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === '--help') {
      console.log(HELP_TEXT);
      process.exit(0);
    } else if (arg === '--mode' || arg === '-m') {
      if (!next || !['block', 'sanitize'].includes(next)) {
        console.error('Error: --mode must be "block" or "sanitize"');
        process.exit(1);
      }
      args.mode = next;
      i++;
    } else if (arg === '--block' || arg === '-b') {
      args.mode = 'block';
    } else if (arg === '--secrets' || arg === '-s') {
      args.blockThreshold.secrets = parseInt(next, 10);
      i++;
    } else if (arg === '--high-severity' || arg === '-h') {
      args.blockThreshold.highSeverity = parseInt(next, 10);
      i++;
    } else if (arg === '--quiet' || arg === '-q') {
      args.quiet = true;
    } else if (arg === '--verbose' || arg === '-v') {
      args.verbose = true;
    } else if (!arg.startsWith('-')) {
      args.file = arg;
    }
  }

  return args;
}

// Read input from file or stdin
async function readInput(file) {
  if (file) {
    try {
      return readFileSync(file, 'utf8');
    } catch (err) {
      console.error(`Error reading file: ${err.message}`);
      process.exit(1);
    }
  }

  // Read from stdin
  if (stdinStream.isTTY) {
    console.error('Error: No input provided. Use --help for usage information.');
    process.exit(1);
  }

  return new Promise((resolve, reject) => {
    let data = '';
    stdinStream.setEncoding('utf8');
    stdinStream.on('data', chunk => data += chunk);
    stdinStream.on('end', () => resolve(data));
    stdinStream.on('error', reject);
  });
}

// Format threat details for verbose output
function formatThreats(threats) {
  if (!threats.details || threats.details.length === 0) {
    return '';
  }

  const lines = ['\nThreats detected:'];
  const grouped = {};

  for (const threat of threats.details) {
    if (!grouped[threat.type]) {
      grouped[threat.type] = [];
    }
    grouped[threat.type].push(threat);
  }

  for (const [type, items] of Object.entries(grouped)) {
    const severity = items[0].severity || 'unknown';
    lines.push(`  - ${type} (${severity}): ${items.length}x`);
  }

  return lines.join('\n');
}

// Main CLI logic
async function main() {
  const args = parseArgs(process.argv);
  const input = await readInput(args.file);

  // Run sanitization (synchronous)
  const result = sanitize(input, {
    mode: args.mode,
    blockThreshold: args.blockThreshold
  });

  // Handle BLOCK mode
  if (args.mode === 'block' && result.blocked) {
    if (!args.quiet) {
      console.error(`\nBLOCKED: ${result.reason}`);
      if (args.verbose) {
        console.error(formatThreats(result.threats));
      }
    }
    process.exit(1);
  }

  // Output sanitized content
  process.stdout.write(result.sanitized);

  // Output statistics (to stderr, so it doesn't pollute piped output)
  if (!args.quiet) {
    const stats = [];

    if (result.threats.secrets > 0) {
      stats.push(`${result.threats.secrets} secret(s) redacted`);
    }

    if (stats.length > 0) {
      console.error(`\n${stats.join(', ')}`);
      if (args.verbose) {
        console.error(formatThreats(result.threats));
      }
    } else {
      console.error('\nNo threats detected - content is clean');
    }
  }

  process.exit(0);
}

// Run CLI
main().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
