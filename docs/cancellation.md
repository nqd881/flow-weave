# Cancellation

`flow-weave` uses a child-flow-focused cancellation model.

## Contract

When stop is requested:

1. No new child/branch flow should start after stop is acknowledged at the start boundary.
2. Already running child/branch flows should receive `requestStop()` propagation.

Child flow propagation is runtime-linked. Built-in executors and custom step executors can use `stepExecution.createChildFlowExecution(flowDef, context)` so stop propagation does not need to be wired manually for each child flow.

This contract focuses on child execution behavior.

## Non-Goals

By design, these may still run around stop timing windows:

- selectors
- loop conditions
- adapt functions

Cancellation guarantees do not require these callbacks to be skipped.

## By Step Type

- `delay`: stop cancels the active wait and stops the step.
- `child-flow`: stop is propagated to the child flow execution.
- `try-catch`: stop during try or catch bypasses recovery and stops the outer step.
- `break`: loop control, not cancellation; it is not affected by stop semantics except normal propagation boundaries.
- retry backoff waits are stoppable and are cancelled when stop is requested.
- `parallel`: stop propagation is wired to all branch executions; non-`all-settled` strategies also request stop on losing branches and wait for them to settle.
- `parallel-for-each`: stop propagation is wired to all item executions; non-`all-settled` strategies also request stop on losing item executions and wait for them to settle.
- `for-each`: stop checks occur before each child start; loop break is supported.
- `while`: stop checks occur before each iteration child start; loop break is supported.
- `switch`: stop checks occur before selected branch start.

Hook lifecycle guidance is documented in `docs/hooks.md`.

## Error Mapping

Stop is represented by `StopSignal` across both step and flow boundaries.
Loop break is represented by `BreakLoopSignal` across both step and flow boundaries.
`StopSignal` is never retried by step retry policies.
Recovery does not run for `StopSignal`.
`BreakLoopSignal` does not produce a separate public execution outcome; it is structured control flow consumed by enclosing loops.

## Recommended Authoring Guidance

- Treat `adapt` as a context transform, not side-effect boundary.
- Put expensive irreversible side effects inside child tasks where stop propagation can control execution.
- If you write custom executors that start child flows, use `createChildFlowExecution(...)` instead of manual stop listeners.
- If you need strict side-effect gates before child start, add explicit stop checks around your custom logic.
