# Troubleshooting

## `SagaDef` Will Not Run

Cause:

- saga runtime support is not installed

Fix:

- install `sagaPlugin` from `flow-weave/saga`
- build the app with `FlowWeave.create().use(sagaPlugin).build()`

## `sagaPlugin` Is Not Exported From `flow-weave`

Cause:

- saga APIs live in the saga subpath

Fix:

```ts
import { sagaPlugin } from "flow-weave/saga";
```

## Decorators Are Not Exported From `flow-weave`

Cause:

- decorators live in style-specific subpaths

Fix:

```ts
import { Flow, Task } from "flow-weave/decorator";
import { Saga } from "flow-weave/saga";
```

## `@Task` / `@Flow` Fails On An Instance Member

Cause:

- flow decorators are static-only

Fix:

- use static class methods and static fields for decorator-authored flows

## Invalid Flow Reference Error

Cause:

- a child-flow decorator received a class that was not decorated with `@Flow` or `@Saga`

Fix:

- pass an `IFlowDef`
- or pass a class decorated with `@Flow` or `@Saga`

## Invalid Step Type At Runtime

Cause:

- runtime executor resolution does not know your custom step definition type

Fix:

- use built-in step types, or
- register a custom executor for your custom step definition

## Flow Stops But Some Code Still Ran

This can happen when logic runs outside child-flow start boundaries.

Expected under the current cancellation model:

- stop guarantees focus on child/branch flow start and propagation
- selector, condition, and adapt logic may still run around stop timing windows
- steps that exit without starting child work may still complete normally

## Compensation Did Not Run

Check:

- the flow is a saga
- compensation is attached to a completed step
- saga finished with `failed` or `stopped`
- saga was not committed before the compensation window closed

## Type Errors With Branch Adapt

Common cause:

- parent context type and branch flow context type do not match

Fix:

- ensure `adapt` returns the exact branch context type
- prefer explicit generic annotations when needed
