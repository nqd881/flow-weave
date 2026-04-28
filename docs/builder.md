# Builder Guide

`flow-weave` has a fluent builder authoring surface centered around `app.weaver()`.

## Imports

Normal app code:

```ts
import { FlowWeave } from "flow-weave";
```

Advanced builder-only types:

```ts
import { FlowDefBuilder, WeaverBuilder } from "flow-weave/builder";
```

## Start A Flow

```ts
const app = FlowWeave.create().build();
const builder = app.weaver();

const flow = builder
  .flow<{ count: number }>("counter")
  .task((ctx) => {
    ctx.count += 1;
  })
  .build();
```

## Step IDs

Use `step(id)` before a step method to assign the next step id.

```ts
const flow = builder
  .flow<{ count: number }>()
  .step("increase")
  .task((ctx) => {
    ctx.count += 1;
  })
  .build();
```

`step(...)` also supports low-level custom step creation:

- `step(existingStep)`
- `step(StepClass, ...args)`
- `step(id, StepClass, ...args)`

## Step Metadata

Attach metadata after the step declaration and before moving on to the next step.

```ts
const flow = builder
  .flow<{ logs: string[] }>()
  .task(() => {
    throw new Error("boom");
  })
  .retry({ maxAttempts: 3, backoff: "exponential" })
  .recover((error, ctx) => {
    ctx.logs.push((error as Error).message);
  })
  .build();
```

Supported metadata methods:

- `hooks(...)`
- `preHooks(...)`
- `postHooks(...)`
- `retry(...)`
- `recover(...)`

See [Hooks](./hooks.md) for lifecycle behavior.

## Composite Steps

The builder API returns helper builders for composite steps.

### Parallel

```ts
const flow = builder
  .flow<{ value: number }>()
  .parallel()
  .branch(childA)
  .branch(childB, (ctx) => ({ value: ctx.value + 1 }))
  .allSettled()
  .join()
  .build();
```

### Switch

```ts
const flow = builder
  .flow<{ payment: string }>()
  .switchOn((ctx) => ctx.payment)
  .case("card", cardFlow)
  .default(fallbackFlow)
  .end()
  .build();
```

### Try / Catch

```ts
const flow = builder
  .flow<{ logs: string[] }>()
  .try(riskyFlow)
  .catch(recoveryFlow, (ctx, error) => ({
    logs: ctx.logs,
    message: (error as Error).message,
  }))
  .end()
  .build();
```

### Iteration

```ts
const flow = builder
  .flow<{ ids: string[] }>()
  .forEach((ctx) => ctx.ids)
  .run(perItemFlow, (_ctx, id) => ({ id }))
  .build();
```

```ts
const flow = builder
  .flow<{ ids: string[] }>()
  .parallelForEach((ctx) => ctx.ids)
  .run(perItemFlow, (_ctx, id) => ({ id }))
  .allSettled()
  .join()
  .build();
```

See [Step Types](./step-types.md) for the full built-in step list.

## Flow Hooks

`flow(...)` accepts flow-level metadata:

```ts
const flow = builder.flow<{ value: number }>("flow-id", {
  hooks: {
    pre: [() => console.log("flow-pre")],
    post: [() => console.log("flow-post")],
  },
});
```

## Builder Plugins And Extensions

Use `WeaverBuilder` when you want to extend the fluent DSL directly.

```ts
import { WeaverBuilder } from "flow-weave/builder";

const weaver = new WeaverBuilder().build();
```

See [Extensibility](./extensibility.md) for custom builder methods.
