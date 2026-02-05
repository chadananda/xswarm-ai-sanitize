# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **CLI Tool**: Added command-line interface accessible via `npx xswarm-ai-sanitize`
  - Supports both file input and stdin
  - Two modes: sanitize (default) and block
  - Configurable thresholds for blocking
  - Quiet and verbose output options
  - Exit codes for CI/CD integration
  - See [docs/CLI.md](./docs/CLI.md) for full documentation

- **New Secret Patterns**: Added 4 critical AI provider patterns
  - `anthropic_api_key`: Anthropic API keys (sk-ant-...)
  - `openai_api_key`: OpenAI API keys (sk-...)
  - `openai_org_key`: OpenAI organization keys (sk-org-...)
  - `cohere_api_key`: Cohere API keys (with entropy checking)

- **Documentation**:
  - Comprehensive CLI guide ([docs/CLI.md](./docs/CLI.md))
  - CLI examples for common use cases
  - Integration guides (Git hooks, CI/CD, Docker)
  - Performance benchmarks

### Changed
- Updated pattern count from 44 to 48 secret patterns
- Enhanced README with CLI quick start section
- Improved package.json with bin entry for CLI

### Technical Details
- CLI implemented in `/bin/cli.js`
- Zero additional dependencies for CLI
- Pattern-only mode for maximum speed and privacy
- Synchronous processing for CLI use cases

## [1.0.0] - Previous Release

Initial release with:
- Pattern-based detection (44 secret patterns, 27 injection patterns)
- AI-enhanced detection (optional)
- Two operational modes (BLOCK and SANITIZE)
- OpenClaw and file watcher plugins
- Comprehensive test suite
- Full Node.js API

---

## Version History

### Unreleased
- CLI tool addition
- 4 new AI provider secret patterns
- Enhanced documentation

### 1.0.0
- Initial release
- Core functionality
- Node.js API
- Plugins

## Migration Guide

### From 1.0.0 to Current

**No breaking changes.** All existing code continues to work.

**New features available:**

1. **CLI Usage:**
   ```bash
   # Old way (programmatic only)
   node -e "import sanitize from 'xswarm-ai-sanitize'; ..."

   # New way (CLI)
   npx xswarm-ai-sanitize myfile.txt
   ```

2. **New Secret Patterns:**
   - Anthropic, OpenAI, and Cohere keys now detected automatically
   - No code changes needed - patterns active by default

## Future Roadmap

### Planned Features
- [ ] Custom pattern configuration via config file
- [ ] Multi-file batch processing
- [ ] Watch mode for continuous monitoring
- [ ] JSON/YAML output format for tooling integration
- [ ] Colored output for terminal
- [ ] Pattern statistics and reporting
- [ ] Whitelist/allowlist support
- [ ] Integration with git-secrets
- [ ] VSCode extension
- [ ] GitHub Action

### Under Consideration
- [ ] Browser/Deno support
- [ ] gRPC API server mode
- [ ] Real-time streaming API
- [ ] Machine learning model integration
- [ ] Custom redaction formats
- [ ] Differential scanning (only check changes)
- [ ] Language-specific parsers (JS, Python, etc.)

## Contributing

See [README.md](./README.md) for contribution guidelines.

## License

MIT - See LICENSE file for details
