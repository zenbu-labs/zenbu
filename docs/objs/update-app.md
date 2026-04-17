# Update the App

## What You're Doing

Pulling the latest code from the upstream repository. Because Zenbu is a git repo cloned to `~/.zenbu/plugins/zenbu`, updating is `git pull`.

## Background

### Why Git Pull Works

The entire application—kernel services, renderer views, database schema, everything—lives as source code in the cloned repo. Dynohot watches all source files. When `git pull` writes new versions of files:

1. Dynohot detects the file changes via its file watcher
2. Changed modules are re-imported (module cache busted)
3. Live `$` proxy references are swapped to point to new exports
4. Services that were re-imported call `runtime.register()` with updated classes
5. The runtime re-evaluates affected services and their transitive dependents in topological order
6. Vite dev servers detect changed frontend files and push HMR updates to iframes

Most updates take effect without restarting the app.

### When Restarts Are Needed

Some changes require a restart:
- Changes to the shell itself (`apps/kernel/`) — this is pre-compiled, not hot-reloaded
- Changes to the loader chain or dynohot configuration
- Node native module changes
- Structural changes to `config.json` or manifest files (though these are watched, edge cases exist)

## Steps

### Current Flow

```bash
cd ~/.zenbu/plugins/zenbu
git pull
```

That's it. Changed files trigger hot reloading automatically.

If dependencies changed (new packages in `package.json`):

```bash
pnpm install
```

If the database schema changed (new migration added), the migration runs automatically on the next app restart or when `DbService` re-evaluates.

### Handling Merge Conflicts

Because users modify their local repo (that's the whole point of Zenbu), upstream changes can conflict with local modifications.

**Simple case — no conflicts:**
```bash
git pull    # fast-forward or clean merge
```

**Conflicts detected:**

Currently, merge conflicts require manual resolution:

```bash
git pull
# If conflicts:
# 1. Resolve conflicts in affected files
# 2. git add <resolved files>
# 3. git merge --continue
```

### Future: Agent-Assisted Conflict Resolution

The planned automated flow:

1. **Pre-pull inspection**: Before pulling, inspect each incoming commit to determine if it would conflict with local changes. This can be checked per-commit.

2. **Clean pull**: If no conflicts, pull directly.

3. **Agent handoff**: If conflicts are detected, hand off to an agent with full context:
   - Complete commit data (diffs, messages) for every incoming commit
   - The local modifications that conflict
   - Code comments explaining intent

4. **Intelligent merge**: The agent resolves conflicts using commit messages as ground truth for what was intended. This is why **commit messages must be extremely verbose and explicit about human intention**—they serve as merge instructions.

5. **Completion**: The agent finishes the merge and the app hot-reloads the resolved files.

This is closely related to the plugin setup method—both need agent intelligence to merge code changes where patches would be brittle.

> **TODO**: Build UI for triggering updates (a "pull" button or automatic update check).

> **TODO**: Implement conflict detection + agent-assisted resolution pipeline.

### Checking What Changed

Before pulling, see what's coming:

```bash
git fetch
git log HEAD..origin/main --oneline
git diff HEAD..origin/main --stat
```

After pulling, check what hot-reloaded by watching the Electron main process console for `[hot]` log messages:

```
[hot] server re-evaluated
[hot] http re-evaluated
[hot] view-chat re-evaluated
```

### Rolling Back

If an update breaks something:

```bash
git reflog                          # find the previous HEAD
git reset --hard HEAD@{1}           # go back one step
```

Dynohot picks up the reverted files and hot-reloads back to the previous state.
