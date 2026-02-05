#!/usr/bin/env node

/**
 * xswarm-ai-sanitize CLI
 * Setup wizard for integrating secret sanitization into AI agent frameworks
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, readdirSync } from 'fs';
import { createInterface } from 'readline';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import sanitize from '../src/index.js';
import { patternCount } from '../src/detectors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Framework detection and integration configs
const FRAMEWORKS = {
  openclaw: {
    name: 'OpenClaw',
    detectPackage: 'openclaw',
    cliCommand: 'openclaw',
    plugin: 'xswarm-ai-sanitize/plugins/openclaw',
    autoInstall: true,
    usage: `Plugin will be auto-installed to ~/.openclaw/extensions/
Run 'openclaw plugins list' to verify installation.`
  },
  langchain: {
    name: 'LangChain',
    detectPackage: 'langchain',
    altPackage: '@langchain/core',
    cliCommand: 'langchain',
    plugin: 'xswarm-ai-sanitize/plugins/langchain',
    usage: `import { createSanitizeCallback } from 'xswarm-ai-sanitize/plugins/langchain';

const chain = new LLMChain({
  llm,
  prompt,
  callbacks: [createSanitizeCallback({ mode: 'sanitize' })]
});`
  },
  llamaindex: {
    name: 'LlamaIndex',
    detectPackage: 'llamaindex',
    plugin: 'xswarm-ai-sanitize/plugins/llamaindex',
    usage: `import { createSanitizeTransform } from 'xswarm-ai-sanitize/plugins/llamaindex';

const queryEngine = index.asQueryEngine({
  responseSynthesizer: createSanitizeTransform(responseSynthesizer)
});`
  },
  'vercel-ai': {
    name: 'Vercel AI SDK',
    detectPackage: 'ai',
    plugin: 'xswarm-ai-sanitize/plugins/vercel-ai',
    usage: `import { sanitizeMiddleware } from 'xswarm-ai-sanitize/plugins/vercel-ai';

const result = await generateText({
  model,
  prompt,
  experimental_middleware: sanitizeMiddleware({ mode: 'sanitize' })
});`
  },
  nanobot: {
    name: 'Nanobot',
    detectPackage: 'nanobot',
    cliCommand: 'nanobot',
    plugin: 'xswarm-ai-sanitize/plugins/nanobot',
    usage: `// In your nanobot.yaml or agent config:
// Add xswarm-ai-sanitize as a filter

import { createSanitizeFilter } from 'xswarm-ai-sanitize/plugins/nanobot';
export default createSanitizeFilter({ mode: 'sanitize' });`
  },
  xswarm: {
    name: 'xSwarm',
    detectPackage: 'xswarm',
    plugin: 'xswarm-ai-sanitize/plugins/xswarm',
    usage: `// xSwarm integration coming soon
// Visit https://xswarm.ai for updates`
  }
};

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

function log(msg = '') { console.log(msg); }
function success(msg) { console.log(`${colors.green}✓${colors.reset} ${msg}`); }
function info(msg) { console.log(`${colors.blue}ℹ${colors.reset} ${msg}`); }
function warn(msg) { console.log(`${colors.yellow}⚠${colors.reset} ${msg}`); }
function error(msg) { console.log(`${colors.red}✗${colors.reset} ${msg}`); }

// Check common paths for framework installations
function checkCommonPaths(framework) {
  const homedir = process.env.HOME || process.env.USERPROFILE || '';
  const paths = [
    // Common project locations
    join(homedir, 'Desktop', 'skills', framework),
    join(homedir, 'projects', framework),
    join(homedir, 'dev', framework),
    join(homedir, 'code', framework),
    join(homedir, framework),
    // Global node_modules
    join(homedir, '.npm-global', 'lib', 'node_modules', framework),
    '/usr/local/lib/node_modules/' + framework,
    // pnpm global
    join(homedir, 'Library', 'pnpm', 'global', '5', 'node_modules', framework),
  ];

  for (const p of paths) {
    if (existsSync(p)) return true;
  }
  return false;
}

// Detect which frameworks are installed system-wide
function detectFrameworks() {
  const detected = [];

  for (const [key, framework] of Object.entries(FRAMEWORKS)) {
    let found = false;

    // Check if CLI command exists (e.g., 'openclaw', 'langchain')
    if (framework.cliCommand) {
      try {
        execSync(`which ${framework.cliCommand}`, { stdio: 'pipe' });
        found = true;
      } catch {}
    }

    // Check global npm installation
    if (!found) {
      try {
        execSync(`npm list -g ${framework.detectPackage} --depth=0 2>/dev/null`, { stdio: 'pipe' });
        found = true;
      } catch {}
    }

    // Check common installation paths
    if (!found && checkCommonPaths(framework.detectPackage)) {
      found = true;
    }

    // Check pnpm global
    if (!found) {
      try {
        execSync(`pnpm list -g ${framework.detectPackage} --depth=0 2>/dev/null`, { stdio: 'pipe' });
        found = true;
      } catch {}
    }

    // Check current directory package.json as fallback
    if (!found) {
      const pkgPath = join(process.cwd(), 'package.json');
      if (existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
          const allDeps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
          if (allDeps[framework.detectPackage] || (framework.altPackage && allDeps[framework.altPackage])) {
            found = true;
          }
        } catch {}
      }
    }

    if (found) {
      detected.push(key);
    }
  }

  return detected;
}

// Interactive prompt helper
function prompt(rl, question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

/**
 * Copy directory recursively (for older Node versions without cpSync recursive)
 */
function copyDirRecursive(src, dest) {
  mkdirSync(dest, { recursive: true });
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      writeFileSync(destPath, readFileSync(srcPath));
    }
  }
}

/**
 * Auto-install OpenClaw plugin to ~/.openclaw/extensions/
 */
function installOpenClawPlugin() {
  const homedir = process.env.HOME || process.env.USERPROFILE;
  if (!homedir) {
    error('Could not determine home directory');
    return false;
  }

  const extensionsDir = join(homedir, '.openclaw', 'extensions');
  const pluginDir = join(extensionsDir, 'xswarm-ai-sanitize');
  const sourcePluginDir = join(__dirname, '..', 'plugins', 'openclaw');
  const sourceSrcDir = join(__dirname, '..', 'src');

  try {
    // Create extensions directory if needed
    mkdirSync(extensionsDir, { recursive: true });

    // Copy plugin files
    info('Copying plugin files...');
    copyDirRecursive(sourcePluginDir, pluginDir);

    // Copy src/ for sanitize core (adjusting import path in index.js)
    info('Copying sanitize core...');
    const srcDestDir = join(pluginDir, 'src');
    copyDirRecursive(sourceSrcDir, srcDestDir);

    // Update the import path in the copied index.js
    const indexPath = join(pluginDir, 'index.js');
    let indexContent = readFileSync(indexPath, 'utf8');
    indexContent = indexContent.replace(
      "import sanitize from '../../src/index.js';",
      "import sanitize from './src/index.js';"
    );
    writeFileSync(indexPath, indexContent);

    log();
    success(`Installed to ${pluginDir}`);
    log();

    // Verify with OpenClaw CLI if available
    try {
      const result = execSync('openclaw plugins list 2>&1', { encoding: 'utf8', timeout: 10000 });
      if (result.includes('xswarm-ai-sanitize') && result.includes('loaded')) {
        success('OpenClaw detected the plugin and loaded it automatically!');
        log();
        info('The plugin will sanitize secrets from tool results before they reach agent memory.');
        info('Detected patterns: AWS keys, GitHub tokens, API keys, database URLs, and 600+ more.');
      } else if (result.includes('xswarm-ai-sanitize')) {
        warn('Plugin installed but not yet loaded. You may need to restart the OpenClaw gateway.');
        info('Run: openclaw gateway restart');
      } else {
        info('Run "openclaw plugins list" to verify the plugin is detected.');
      }
    } catch {
      // OpenClaw CLI not available or failed
      info('Run "openclaw plugins list" to verify the plugin is detected.');
    }

    return true;
  } catch (e) {
    error(`Installation failed: ${e.message}`);
    return false;
  }
}

// Main wizard
async function runWizard() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  log();
  log(`${colors.bold}${colors.cyan}xswarm-ai-sanitize${colors.reset} — Secret Detection for AI Agents`);
  log(`${colors.dim}${patternCount} patterns + Shannon entropy analysis${colors.reset}`);
  log();

  info('Scanning for installed AI frameworks...');
  const detected = detectFrameworks();

  if (detected.length > 0) {
    success(`Found: ${detected.map(k => FRAMEWORKS[k].name).join(', ')}`);
  } else {
    info('No AI frameworks detected on this system.');
  }
  log();

  // Show menu
  log(`${colors.bold}Available integrations:${colors.reset}`);
  log();

  const frameworkKeys = Object.keys(FRAMEWORKS);
  frameworkKeys.forEach((key, i) => {
    const fw = FRAMEWORKS[key];
    const isDetected = detected.includes(key);
    const marker = isDetected ? `${colors.green}●${colors.reset}` : `${colors.dim}○${colors.reset}`;
    log(`  ${marker} ${i + 1}) ${fw.name}${isDetected ? ` ${colors.dim}(installed)${colors.reset}` : ''}`);
  });

  log();
  log(`  ${colors.dim}s) Sanitize text (CLI mode)${colors.reset}`);
  log(`  ${colors.dim}q) Quit${colors.reset}`);
  log();

  const answer = await prompt(rl, `${colors.bold}Select integration (1-${frameworkKeys.length}, s, or q):${colors.reset} `);

  if (answer.toLowerCase() === 'q') {
    log('Goodbye!');
    rl.close();
    process.exit(0);
  }

  if (answer.toLowerCase() === 's') {
    rl.close();
    await runSanitizeCLI();
    return;
  }

  const idx = parseInt(answer, 10) - 1;
  if (idx >= 0 && idx < frameworkKeys.length) {
    const key = frameworkKeys[idx];
    const fw = FRAMEWORKS[key];

    log();
    log(`${colors.bold}${fw.name} Integration${colors.reset}`);
    log();

    // Handle auto-install frameworks (OpenClaw)
    if (fw.autoInstall) {
      info('Auto-installing plugin...');
      log();
      if (installOpenClawPlugin()) {
        success('Plugin installed successfully!');
      }
    } else {
      // Manual install instructions for other frameworks
      log(`${colors.dim}1. Install the package (if not already):${colors.reset}`);
      log(`   npm install xswarm-ai-sanitize`);
      log();
      log(`${colors.dim}2. Add to your code:${colors.reset}`);
      log();
      log(`${colors.cyan}${fw.usage}${colors.reset}`);
      log();
      success('Plugin ready to use!');
    }
  } else {
    error('Invalid selection');
  }

  rl.close();
}

// CLI sanitize mode (original functionality)
async function runSanitizeCLI() {
  const args = process.argv.slice(2).filter(a => a !== 'sanitize' && a !== 's');

  const options = {
    mode: 'sanitize',
    blockThreshold: { secrets: 3, highSeverity: 1 },
    quiet: false,
    file: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      showSanitizeHelp();
      process.exit(0);
    } else if (arg === '--block' || arg === '-b') {
      options.mode = 'block';
    } else if (arg === '--quiet' || arg === '-q') {
      options.quiet = true;
    } else if (arg === '--secrets' || arg === '-s') {
      options.blockThreshold.secrets = parseInt(args[++i], 10);
    } else if (!arg.startsWith('-')) {
      options.file = arg;
    }
  }

  // Read input
  let input;
  if (options.file) {
    try {
      input = readFileSync(options.file, 'utf8');
    } catch (e) {
      error(`Cannot read file: ${options.file}`);
      process.exit(1);
    }
  } else if (!process.stdin.isTTY) {
    input = await readStdin();
  } else {
    error('No input provided. Pipe text or specify a file.');
    showSanitizeHelp();
    process.exit(1);
  }

  // Sanitize
  const result = sanitize(input, options);

  if (options.mode === 'block' && result.blocked) {
    if (!options.quiet) {
      console.error(`\nBLOCKED: ${result.reason}`);
    }
    process.exit(1);
  }

  process.stdout.write(result.sanitized);

  if (!options.quiet && result.threats.secrets > 0) {
    console.error(`\n${result.threats.secrets} secret(s) redacted`);
  }
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
  });
}

function showSanitizeHelp() {
  log(`
${colors.bold}xswarm-ai-sanitize sanitize${colors.reset} — CLI Secret Redaction

${colors.bold}Usage:${colors.reset}
  xswarm-ai-sanitize sanitize [options] [file]
  cat file.txt | xswarm-ai-sanitize sanitize [options]

${colors.bold}Options:${colors.reset}
  -b, --block     Block mode (exit 1 if secrets found)
  -s, --secrets   Block threshold (default: 3)
  -q, --quiet     Suppress statistics
  -h, --help      Show this help

${colors.bold}Examples:${colors.reset}
  echo "key=sk-ant-xxx" | xswarm-ai-sanitize sanitize -q
  xswarm-ai-sanitize sanitize -b config.yml
`);
}

function showMainHelp() {
  log(`
${colors.bold}xswarm-ai-sanitize${colors.reset} — Secret Detection for AI Agents

${colors.bold}Usage:${colors.reset}
  npx xswarm-ai-sanitize           Interactive setup wizard
  npx xswarm-ai-sanitize sanitize  CLI text sanitization

${colors.bold}Features:${colors.reset}
  • ${patternCount} secret patterns (AWS, GitHub, Stripe, etc.)
  • Shannon entropy analysis for unknown secrets
  • Plugins for OpenClaw, LangChain, LlamaIndex, Vercel AI, and more
  • Zero dependencies, fully synchronous

${colors.bold}Learn more:${colors.reset} https://github.com/chadananda/xswarm-ai-sanitize
`);
}

// Main entry
const args = process.argv.slice(2);

if (args.includes('--help') && !args.includes('sanitize')) {
  showMainHelp();
  process.exit(0);
}

if (args[0] === 'sanitize' || args[0] === 's' || !process.stdin.isTTY) {
  // If stdin has data, go directly to sanitize mode
  if (!process.stdin.isTTY && args[0] !== 'sanitize' && args[0] !== 's') {
    args.unshift('sanitize');
  }
  runSanitizeCLI();
} else {
  runWizard();
}
