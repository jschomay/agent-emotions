---
name: psychoanalyze
description: Open a live local dashboard visualizing this project's agent-emotions state and history
disable-model-invocation: true
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/dashboard-launch.js *), Bash(open *)
---

Run this exact command and capture its output — the last line is a URL:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/dashboard-launch.js" "${CLAUDE_PROJECT_DIR}" "${CLAUDE_PLUGIN_DATA}"
```

This starts (or reuses, if already running for this project) a small local dashboard server reading the same persisted state the plugin's hooks write — nothing separate. Then open that URL in the browser:

```
open "<the URL from the previous command>"
```

Tell the user the dashboard is open and briefly what it shows (topology graph, current-state radar, disposition, state-over-time, and a per-turn table of how each message was read). Don't summarize the actual emotional data yourself — the point is for them to look at it live.
