# dsh-squares

[**English**](README.md) | [中文](README.zh-CN.md)

An **all-in-one workspace plugin** for DSH (DeepSeek Harness): it adds a global
「Square」panel to the Web GUI sidebar that manages **Skills / Experts / Connectors (MCP) / Plugins**
in a single place. **Web (`dsh web`) and Desktop (DeepSeek Harness.app) share the same code and build output.**

Sidebar → 「Square」panel: the four tabs show the Square (official/community catalog) by default; the
「My Experts / My Skills / My MCP / My Plugins」items in the top-right open sub-pages to manage local
content, and 「Back to Square」at the top of the sub-page returns to the Square.

## 1. Installation

Published on npm and GitHub:

```bash
dsh plugin --profile web add dsh-squares            # install from npm
dsh plugin --profile web add github:ai-tool-labs/dsh-squares   # or from GitHub
# Desktop: open the "Plugins" panel in the sidebar → click "Add Plugin" → type "dsh-squares" → Install
# Restart harness after installing to take effect (Desktop: restart the App; Web: restart dsh web)
```

A 「Square」entry then appears in the sidebar; click it to open the panel.

## 2. Screenshots

The **Square** panel as it appears in the Web GUI sidebar:

![Square example](assets/example/example-01.png)

## 3. Development

```bash
pnpm --filter dsh-squares typecheck    # host + client tsconfigs
pnpm --filter dsh-squares build        # tsc(host) + tsc(client .d.ts) + esbuild bundle
pnpm --filter dsh-squares smoke        # host smoke test (real Cordis lifecycle + filesystem + routes)
pnpm --filter dsh-squares test:routes  # route integration (expert/connector write paths)
pnpm --filter dsh-squares check:client # bundle shape / id / external-dependency allowlist + mock loader
```

### Building and installing from source (developer)

```bash
pnpm --filter dsh-squares build                                 # build (run pnpm install in the workspace first)
dsh plugin --profile web add /absolute/path/dsh-squares    # 2A) Web profile
# 2B) Desktop: the profile is exclusively owned by Electron; use a relative path to write it into the manifest and link via pnpm
python3 - <<'PY'
import json, pathlib
p = pathlib.Path.home() / '.dsh/profiles/desktop/package.json'
d = json.loads(p.read_text())
d.setdefault('dependencies', {})['dsh-squares'] = 'link:/absolute/path/packages/dsh-squares'
bundles = d['dsh']['profile']['bundles']
if 'dsh-squares' not in bundles:
    bundles.append('dsh-squares')
p.write_text(json.dumps(d, indent=2) + '\n')
PY
cd ~/.dsh/profiles/desktop && CI=true pnpm install
# 3) Restart harness (Desktop: reopen the App; Web: restart dsh web)
```
