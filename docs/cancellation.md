# Cancellation

`flow-weave` uses a child-flow-focused cancellation model.

## Contract

When stop is requested:

1. No new child/branch flow should start after stop is acknowledged at the start boundary.
2. Already running child/branch flows should receive `requestStop()` propagation.

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
- `parallel`: stop propagation is wired to all branch executions.
- `parallel-for-each`: stop propagation is wired to all item executions.
- `for-each`: stop checks occur before each child start.
- `while`: stop checks occur before each iteration child start.
- `switch`: stop checks occur before selected branch start.

Hook lifecycle guidance is documented in `docs/hooks.md`.

## Error Mapping

Stop in child flow runtime is represented by `FlowStoppedError`.

Executors map that to `StepStoppedError` so step-level state remains consistent.

## Recommended Authoring Guidance

- Treat `adapt` as a context transform, not side-effect boundary.
- Put expensive irreversible side effects inside child tasks where stop propagation can control execution.
- If you need strict side-effect gates before child start, add explicit stop checks around your custom logic.
