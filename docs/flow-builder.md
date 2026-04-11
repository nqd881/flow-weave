# Flow Builder

## Entry Points

Use `FlowWeave` app:

- `app.weaver().flow<TContext>(id?, options?)`

Core `Weaver` provides `flow(...)` by default.
`saga(...)` is added by `sagaPlugin`.

```ts
import { FlowWeave } from "flow-weave";

const app = FlowWeave.create().build();
const builder = app.weaver();
```

## Step IDs

Use `step(id)` before a step method to assign id to the next step.
If a simple step draft is still open, `step(id)` closes it first and stores the id for the following step.

`step(...)` also supports low-level custom step creation:

- `step(existingStep)` adds an existing step instance as-is
- `step(StepClass, ...args)` opens a new simple step draft from a step class
- `step(id, StepClass, ...args)` opens a new simple step draft with an explicit id

When a step instance is provided, any pending step id is ignored and the instance is added unchanged.

```ts
builder
  .flow<{ count: number }>()
  .step("increase")
  .task((ctx) => {
    ctx.count += 1;
  })
  .build();
```

## Task Step

`task(taskFn)` runs a function with the current context.

```ts
.task(async (ctx) => {
  await save(ctx);
})
```

## Delay Step

`delay(msOrSelector)` pauses execution before moving to the next step.

```ts
.delay(1000)
.delay((ctx) => ctx.retryDelayMs)
```

`delay` is stoppable while waiting.

## Child Flow Step

`childFlow(flow, adapt?)` runs one child flow sequentially.

```ts
const child = builder
  .flow<{ value: number }>()
  .task((ctx) => {
    ctx.value += 1;
  })
  .build();

const flow = builder
  .flow<{ count: number }>()
  .childFlow(child, (ctx) => ({ value: ctx.count }))
  .build();
```

## Step Hooks

Simple steps can be configured after declaration with `hooks`, `preHooks`, and `postHooks`.

```ts
.task((ctx) => {
  ctx.value += 1;
})
.hooks({
  pre: [(_ctx, { stepId }) => console.log("pre", stepId)],
  post: [(_ctx, { stepId, status }) => console.log("post", stepId, status)],
})
```

`pre` runs before step execution, `post` runs after step execution.
These methods apply to the currently declared simple step or the active composite step builder.
Calling `step(id)` closes the current simple step draft, so `hooks()` must be called before `step(id)` or after the next step is declared.

## Flow Hook Options

`flow` and plugin-provided `saga` accept flow-level `hooks` options.

```ts
const flow = builder
  .flow<{ value: number }>("flow-id", {
    hooks: {
      pre: [() => console.log("flow-pre")],
      post: [() => console.log("flow-post")],
    },
  })
  .task((ctx) => {
    ctx.value += 1;
  })
  .build();
```

```ts
builder
  .flow<{ value: number }>()
  .step("hooked-task")
  .task((ctx) => {
    ctx.value += 1;
  })
  .hooks({
    pre: [(_ctx, { stepId }) => console.log("pre", stepId)],
    post: [(_ctx, { stepId, status }) => console.log("post", stepId, status)],
  })
  .build();
```

See `docs/hooks.md` for lifecycle order, layer ownership, and error behavior.

## Parallel Step

`parallel()` starts a builder for branch flows.

```ts
const flow = builder
  .flow<{ n: number }>()
  .parallel()
  .branch(builder.flow().task(() => {}).build())
  .branch(
    (weaver) => weaver.flow().task(() => {}).build(),
  )
  .allSettled()
  .join()
  .build();
```

### Strategies

- `allSettled()`
- `failFast()`
- `firstSettled()`
- `firstCompleted()`

## While Step

`while(condition, iterationFlow, adapt?)`

- `condition(context)` returns boolean or promise
- `iterationFlow` runs once per successful condition check
- `adapt` optionally maps parent context to iteration context

```ts
const incrementFlow = builder
  .flow<{ count: number }>()
  .task((ctx) => {
    ctx.count += 1;
  })
  .build();

const flow = builder
  .flow<{ count: number }>()
  .while((ctx) => ctx.count < 3, incrementFlow)
  .build();
```

## If Step

`if(condition, trueFlow, elseFlow?)` is a convenience around switch behavior.

```ts
.if(
  (ctx) => ctx.approved,
  (weaver) => weaver.flow().task(() => console.log("ok")).build(),
  (weaver) => weaver.flow().task(() => console.log("reject")).build(),
)
```

## Switch Step

`switchOn(selector)` returns switch builder.

```ts
const flow = builder
  .flow<{ code: number }>()
  .switchOn((ctx) => ctx.code)
  .case(200, (weaver) => weaver.flow().task(() => {}).build())
  .caseWhen((value) => value >= 500, (weaver) => weaver.flow().task(() => {}).build())
  .default((weaver) => weaver.flow().task(() => {}).build())
  .end()
  .build();
```

## ForEach Step

Sequentially runs one child flow per selected item.

```ts
const flow = builder
  .flow<{ items: number[] }>()
  .forEach((ctx) => ctx.items)
  .hooks({ pre: [() => console.log("forEach-pre")] })
  .run(
    (weaver) => weaver.flow<{ value: number }>().task(() => {}).build(),
    (_parent, item) => ({ value: item }),
  )
  .build();
```

## ParallelForEach Step

Runs one child flow per selected item in parallel.

```ts
const flow = builder
  .flow<{ items: number[] }>()
  .parallelForEach((ctx) => ctx.items)
  .hooks({ post: [(_ctx, { status }) => console.log("parallelForEach-post", status)] })
  .run(
    (weaver) => weaver.flow<{ value: number }>().task(() => {}).build(),
    (_parent, item) => ({ value: item }),
  )
  .failFast()
  .join()
  .build();
```
