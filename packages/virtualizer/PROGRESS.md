# Virtualizer Optimization Progress

## Status: IN PROGRESS

## Budget Targets
| Metric | Target | Current Best |
|--------|--------|-------------|
| Peak long task | <=16ms | 30.0ms |
| React passes/tab switch | <=2 | 5 |
| Renders/tab switch | <=60 | 52 |
| Layouts/interaction | <=2 | 6 |
| GC pause | <=5ms | 0ms |
| Fuzz tests | 5/5 pass | 5/5 pass |

## Experiment Log

### Experiment 0: Baseline (BASELINE)
- Peak long task: 30.0ms
- Max React passes: 5
- Max renders: 52
- Max layouts: 6
- Fuzz: 5/5 pass
- Key issue: Tab switches cause 5 React render passes (budget: 2). Each measurement triggers a state update via rAF, which triggers re-render, which mounts new items needing measurement, cascading 5 times.

## Key Bottleneck Analysis
The perf report shows the cascade pattern clearly:
1. Tab switch → React render pass 1 (mount VirtualizedList)
2. Items mount → ResizeObserver fires → onMeasurementChange → rAF → setState → pass 2
3. New items from pass 2 mount → more measurements → pass 3
4. Continues until all visible items measured (passes 4-5)

The root cause: `onMeasurementChange` calls `setMeasurementVersion(c => c+1)` via rAF batching, which triggers a new React render, which may render new items that need measuring, which triggers another `onMeasurementChange`.

## Running Best
- Experiment 0: baseline (30.0ms / 5 passes / 52 renders)
