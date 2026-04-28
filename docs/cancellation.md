# Cancellation

`flow-weave` uses a child-flow-focused cancellation model.

## Contract

When stop is requested:

1. no new child or branch flow should start after stop is acknowledged at the start boundary
2. already running child or branch flows should receive `requestStop()` propagation

Child-flow propagation is runtime-linked.
Built-in executors and custom executors should prefer `stepExecution.createChildFlowExecution(flowDef, context)` so stop wiring stays centralized.

## Non-Goals

These callbacks may still run around stop timing windows:

- selectors
- loop conditions
- adapt functions

Cancellation guarantees do not require those callbacks to be skipped.

## By Step Type

- `delay`: stop cancels the active wait
- `child-flow`: stop propagates into the child flow execution
- `try-catch`: stop during try or catch bypasses recovery and stops the outer step
- `parallel`: stop propagates to all branch executions; non-`all-settled` strategies also stop losing branches
- `parallel-for-each`: same propagation model as `parallel`
- `for-each`: stop checks run before each child start
- `while`: stop checks run before each iteration child start
- `switch`: stop checks run before selected branch start
- `break`: loop control, not cancellation

## Error Mapping

- `StopSignal` represents cancellation across step and flow boundaries
- `BreakLoopSignal` represents structured loop control
- `StopSignal` is never retried
- recovery does not run for `StopSignal`
- `BreakLoopSignal` is not a public execution outcome kind

## Recommended Guidance

- treat `adapt` as a context transform, not a side-effect boundary
- put expensive irreversible work inside child tasks where stop propagation can control execution
- if you write custom executors that start child flows, use `createChildFlowExecution(...)`
- if you need strict stop gates before child start, add explicit stop checks around your own logic
