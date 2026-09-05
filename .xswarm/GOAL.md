<!-- PROPOSED by goal-propose.py. Inferred from repo evidence, not
     confirmed by Chad. Raise at the next planning meeting. -->

# Goal (PROPOSED)

## What this is for

The user is Chad's own agent fleet, and secondarily anyone else running agents against private data. Agents on this fleet read email, Drive, scraped sites and local repos, then write what they read into places that persist: `xswarm-subconscious` memory files, herdr session logs, site2rag ingest output, `worker-status.json`. Any credential that passes through an agent's context today gets written to disk in plaintext and stays there. This package is the choke point that strips those credentials at the boundary — in the tool wrapper or the file watcher — so the persistence layer never receives them. What changes: a leaked key in an inbox stops becoming a leaked key in a memory store that is backed up, synced through Dropbox, and read by every future session. (Inferred: the README frames this generically, but the plugin list — OpenClaw, Nanobot, xSwarm — and the sibling `xswarm-*` projects say the first real consumer is Chad's fleet, not the npm public.)

## What success looks like

Every agent entry point on the fleet has sanitize in front of the write path, not just available as an import. Nobody wires it in by hand — installing an xSwarm component installs the interception. A year in, grepping the entire subconscious store, herdr logs and site2rag output for live credential shapes returns nothing, and that fact is verified on a schedule rather than believed. The pattern set has been corrected by real hits: patterns removed because they only ever fired on false positives, patterns added because something got through. False-positive rate is a tracked number, not a vibe.

## What would falsify this

Run the current detector, read-only, over 30 days of accumulated agent memory and logs across the fleet. Two outcomes kill the premise:

1. **Zero real credentials found.** Then agent memory is not a live leak path here, secrets are already contained upstream in env files and `.gitignore`, and this is defensive work against a threat that doesn't fire. It becomes a public npm package with no internal user — a different project with a different goal.
2. **The redactions are worse than the leaks.** If `sanitize` mode mangles content agents need — content hashes, base64 payloads, UUIDs, OCR output from site2rag, high-entropy tokens that aren't secrets — then agents get dumber in exchange for protection against something rare. A measurable version: if more than ~1 in 100 redactions in real fleet traffic is a false positive that removed information the agent needed, the interception cost exceeds the leak cost and `block` mode with a high threshold is the only defensible default.

The second is the likelier failure. 607 regexes plus entropy scoring over arbitrary scraped text is a false-positive machine, and nothing in the repo measures that rate against real traffic — the tests are pattern-vs-fixture.

## Explicitly not the goal

Becoming a general secret scanner for git repos. gitleaks, trufflehog and detect-secrets own that, they have years of pattern curation and CI integrations, and the `security-scan` skill's use of this package as a pre-commit check is a convenience, not the mission. The tempting drift is to chase pattern-count parity with those tools and add repo history scanning, GitHub Actions, baseline files. That is a losing race on a different axis. The defensible position is the one nobody else holds: sitting inside the agent's tool-call and memory-write path, synchronously, with no network call and no dependencies. Optimize for that placement, not for pattern count.

Also not the goal: a hosted service, a dashboard, or a paid tier. This is infrastructure for the fleet that happens to be public.

## Where I am guessing

- **That the fleet is the primary customer and npm is distribution, not the product.** If Chad intends this as a standalone open-source play with adoption as the metric, almost everything above is wrong — the goal becomes README quality, framework coverage and download counts, and internal fleet integration is a demo.
- **That the leak has actually happened.** I am assuming the motivating incident is real — a key found in a memory file or a log. If this is purely anticipatory, the falsification test in §3 is the first thing to run and may end the project.
- **That false positives are unmeasured.** I read the tests as fixture-based. If there's an FP benchmark against real corpora somewhere I didn't find, that bullet is noise.
- **That `xswarm-subconscious` is the write path that matters most.** It's the one that persists deliberately and forever. But herdr session logs may be the bigger surface and are not on the plugin list at all.
- **Overlap flagged:** the `security-scan` skill, the `plugins/watcher` file watcher, and the not-yet-built `plugins/xswarm` are three different answers to the same question — where does interception live. Pick one as canonical. Three half-wired entry points is how a choke point stops being a choke point.
- **That "600+ patterns" is a liability being counted as an asset.** Pattern count is the headline in the README and in package.json. I'd expect the useful set on real fleet traffic to be under 50, with the rest contributing false positives and scan cost. Weak inference — I did not sample the pattern list beyond the first few entries.
