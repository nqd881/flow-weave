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

## Try-Catch Step

`try(flow, adapt?).catch(flow, adapt?).end()` runs one child flow and handles try-branch failures with a catch flow.

```ts
const tryFlow = builder
  .flow<{ events: string[] }>()
  .task((ctx) => {
    ctx.events.push("try");
    throw new Error("boom");
  })
  .build();

const catchFlow = builder
  .flow<{ message: string; events: string[] }>()
  .task((ctx) => {
    ctx.events.push(`catch:${ctx.message}`);
  })
  .build();

builder
  .flow<{ events: string[] }>()
  .try(tryFlow)
  .catch(catchFlow, (ctx, error) => ({
    message: (error as Error).message,
    events: ctx.events,
  }))
  .end();
```

Notes:

- successful try path => outer step completes normally
- failed try path + successful catch path => outer step finishes with `completed` outcome
- stop during try or catch bypasses recovery and stops the step

## Break Step

`break()` exits the nearest enclosing `while()` or `forEach()` loop.

```ts
const iterationFlow = builder
  .flow<{ count: number }>()
  .if(
    (ctx) => ctx.count > 10,
    (nestedWeaver) => nestedWeaver.flow<{ count: number }>().break().build(),
  )
  .build();

builder
  .flow<{ count: number }>()
  .while((ctx) => ctx.count < 100, iterationFlow)
  .task(() => {
    console.log("after loop");
  });
```

Notes:

- break bubbles through `if`, `switch`, `childFlow`, and `try-catch`
- the nearest enclosing `while` or `forEach` consumes it and completes normally
- `parallel` and `parallelForEach` do not support `break()` in v1

## Step Hooks

Simple steps can be configured after declaration with `hooks`, `preHooks`, and `postHooks`.

```ts
.task((ctx) => {
  ctx.value += 1;
})
.hooks({
  pre: [(_ctx, { stepId }) => console.log("pre", stepId)],
  post: [(_ctx, { stepId, status, outcome }) => console.log("post", stepId, status, outcome?.kind)],
})
```

`pre` runs before step execution, `post` runs after step execution.
These methods apply to the currently declared simple step or the active composite step builder.
Calling `step(id)` closes the current simple step draft, so `hooks()` must be called before `step(id)` or after the next step is declared.

## Retry And Recover

All step types can use fluent retry and recovery metadata.

```ts
.task(doCharge)
.retry({
  maxAttempts: 3,
  initialDelayMs: 1000,
  backoff: "exponential",
  maxDelayMs: 10000,
})
.recover((error, ctx) => {
  ctx.logs.push(`recovered:${(error as Error).message}`);
})
```

- `retry(...)` retries only the step executor logic
- retries run against the current mutable context
- `recover(...)` runs only after retries are exhausted
- if `recover(...)` succeeds, the step finishes with `recovered` outcome and the flow continues
- use `postHooks(...)` if you only need side effects after the final failed outcome

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
