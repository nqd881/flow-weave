# Troubleshooting

## Error: Flow runtime not found

Cause:

- flow kind does not match any registered flow runtime in `Runtime`

Fix:

- use `FlowWeave.create().build().runtime()` for built-in `FlowDef`
- install `sagaPlugin` when running `SagaDef`
- or configure a runtime via `RuntimeBuilder.withFlowRuntime(...)`

## Error: Invalid step type

Cause:

- runtime executor resolution does not know your step definition type

Fix:

- use built-in step types, or
- add execution support for your custom step type

## Flow stops but some code still ran

This can happen if logic runs outside child-flow start boundaries.

Expected under current cancellation model:

- stop guarantees focus on child/branch flow start and propagation
- selector/condition/adapt logic may still execute around stop timing windows
- steps that exit without starting child work (for example no match, no items, zero iterations) may still complete normally

## Compensation did not run

Check:

- flow is a saga (`saga`)
- compensation is attached via `compensateWith` after a step
- saga finished with outcome `failed` or `stopped`
- saga was not committed before compensation registration window

## Type errors with branch adapt

Common cause:

- parent context type and branch flow context type mismatch

Fix:

- ensure `adapt` returns the exact branch context type
- prefer explicit generic annotation for branch flow context when needed
