# Decorator Guide

`flow-weave` also supports a decorator-based authoring surface.

## Imports

Core flow decorators come from:

```ts
import { IFlowDef } from "flow-weave";
import { Flow, Task } from "flow-weave/decorator";
```

Saga decorators come from:

```ts
import { Saga, CompensateWith, CommitPoint } from "flow-weave/saga";
```

The root package does not export decorators.

## Requirements

- TC39 Stage 3 decorators
- static class members only
- decorated classes compile to `flowDef`

## Start A Flow

```ts
import { IFlowDef } from "flow-weave";
import { Flow, Task } from "flow-weave/decorator";

type Ctx = { count: number };

@Flow<Ctx>("counter")
class CounterFlow {
  declare static readonly flowDef: IFlowDef<Ctx>;

  @Task()
  static increment(ctx: Ctx) {
    ctx.count += 1;
  }
}
```

## Method And Field Decorators

Use a static method when the method body has meaning.

- `@Task()` uses the method as the task body
- `@ChildFlow(...)` on a method uses the method as the context adapter
- `@ForEach(...)`, `@ParallelForEach(...)`, and `@While(...)` on methods use the method as the adapter

Use a static field when the step has only configuration and no method body.

```ts
import { IFlowDef } from "flow-weave";

@Flow<{ waitMs: number }>("example")
class ExampleFlow {
  declare static readonly flowDef: IFlowDef<{ waitMs: number }>;

  @Task()
  static start() {}

  @Delay((ctx) => ctx.waitMs)
  static wait: void;
}
```

## Step Metadata Decorators

Attach metadata below the main step decorator.

```ts
import { IFlowDef } from "flow-weave";

@Flow<{ logs: string[] }>("payment")
class PaymentFlow {
  declare static readonly flowDef: IFlowDef<{ logs: string[] }>;

  @Task()
  @StepId("charge")
  @Retry({ maxAttempts: 3, backoff: "exponential" })
  @PreHook(() => console.log("pre"))
  @PostHook(() => console.log("post"))
  @Recover((error, ctx) => {
    ctx.logs.push((error as Error).message);
  })
  static charge() {
    throw new Error("boom");
  }
}
```

Supported metadata decorators:

- `@StepId(...)`
- `@Retry(...)`
- `@Recover(...)`
- `@PreHook(...)`
- `@PostHook(...)`

## Composite Decorators

### Parallel

```ts
import { IFlowDef } from "flow-weave";

@Flow("order")
class OrderFlow {
  declare static readonly flowDef: IFlowDef;

  @Parallel({ strategy: "fail-fast" })
  @Branch(EmailFlow)
  @Branch(InventoryFlow)
  static fanOut: void;
}
```

Parallel strategy values:

- `"all-settled"`
- `"all-completed"`
- `"fail-fast"`
- `"first-settled"`
- `"first-completed"`

### Switch

```ts
import { IFlowDef } from "flow-weave";

@Flow<{ payment: string }>("routing")
class RoutingFlow {
  declare static readonly flowDef: IFlowDef<{ payment: string }>;

  @Switch((ctx) => ctx.payment)
  @Case("card", CardFlow)
  @Default(FallbackFlow)
  static route: void;
}
```

### Try / Catch

```ts
import { IFlowDef } from "flow-weave";

@Flow("safe")
class SafeFlow {
  declare static readonly flowDef: IFlowDef;

  @Try(RiskyFlow)
  @Catch(RecoveryFlow)
  static guarded: void;
}
```

## Flow References

Decorators that run child flows accept either:

- an `IFlowDef`
- a class decorated with `@Flow` or `@Saga`

Invalid class refs fail fast.

## Validation Rules

- decorators are static-only
- `@Parallel` requires at least one `@Branch`
- `@Switch` requires at least one `@Case` or `@Default`
- `@Try` requires `@Catch`

## Custom Decorators

Use the exported helper factories:

- `createStepDecorator(...)`
- `createMethodStepDecorator(...)`
- `createSubDecorator(...)`

These compile down to the same `FlowDef` / `StepDef` model as the built-in decorators.

See [Extensibility](./extensibility.md) for custom decorator patterns.
