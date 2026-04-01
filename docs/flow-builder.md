# Flow Builder

## Entry Points

Use `FlowBuilderClient`:

- `newFlow<TContext>(id?, options?)`
- `newSaga<TContext>(id?, options?)`

Both return fluent builders.

## Step IDs

Use `step(id)` before a step method to assign id to the next step.

```ts
builder
  .newFlow<{ count: number }>()
  .step("increase")
  .task((ctx) => {
    ctx.count += 1;
  })
  .build();
```

## Task Step

`task(taskFn, options?)` runs a function with the current context.

```ts
.task(async (ctx) => {
  await save(ctx);
})
```

## Step Hook Options

All step-creation methods support optional `hooks`:

```ts
{
  hooks: {
    pre?: StepHook[];
    post?: StepHook[];
  }
}
```

`pre` runs before step execution, `post` runs after step execution.

## Flow Hook Options

`newFlow` and `newSaga` accept flow-level `hooks` options.

```ts
const flow = builder
  .newFlow<{ value: number }>("flow-id", {
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
  .newFlow<{ value: number }>()
  .step("hooked-task")
  .task(
    (ctx) => {
      ctx.value += 1;
    },
    {
      hooks: {
        pre: [(_ctx, { stepId }) => console.log("pre", stepId)],
        post: [(_ctx, { stepId, status }) => console.log("post", stepId, status)],
      },
    },
  )
  .build();
```

See `docs/hooks.md` for lifecycle order, layer ownership, and error behavior.

## Parallel Step

`parallel(options?)` starts a builder for branch flows.

```ts
const flow = builder
  .newFlow<{ n: number }>()
  .parallel()
  .branch(builder.newFlow().task(() => {}).build())
  .branch(
    (c) => c.newFlow().task(() => {}).build(),
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

`while(condition, iterationFlow, adapt?, options?)`

- `condition(context)` returns boolean or promise
- `iterationFlow` runs once per successful condition check
- `adapt` optionally maps parent context to iteration context

```ts
const incrementFlow = builder
  .newFlow<{ count: number }>()
  .task((ctx) => {
    ctx.count += 1;
  })
  .build();

const flow = builder
  .newFlow<{ count: number }>()
  .while((ctx) => ctx.count < 3, incrementFlow)
  .build();
```

## If Step

`if(condition, trueFlow, elseFlow?, options?)` is a convenience around switch behavior.

```ts
.if(
  (ctx) => ctx.approved,
  (c) => c.newFlow().task(() => console.log("ok")).build(),
  (c) => c.newFlow().task(() => console.log("reject")).build(),
)
```

## Switch Step

`switchOn(selector, options?)` returns switch builder.

```ts
const flow = builder
  .newFlow<{ code: number }>()
  .switchOn((ctx) => ctx.code)
  .case(200, (c) => c.newFlow().task(() => {}).build())
  .caseWhen((value) => value >= 500, (c) => c.newFlow().task(() => {}).build())
  .default((c) => c.newFlow().task(() => {}).build())
  .end()
  .build();
```

## ForEach Step

Sequentially runs one child flow per selected item.

```ts
const flow = builder
  .newFlow<{ items: number[] }>()
  .forEach((ctx) => ctx.items, {
    hooks: { pre: [() => console.log("forEach-pre")] },
  })
  .run(
    (c) => c.newFlow<{ value: number }>().task(() => {}).build(),
    (_parent, item) => ({ value: item }),
  )
  .build();
```

## ParallelForEach Step

Runs one child flow per selected item in parallel.

```ts
const flow = builder
  .newFlow<{ items: number[] }>()
  .parallelForEach((ctx) => ctx.items, {
    hooks: { post: [(_ctx, { status }) => console.log("parallelForEach-post", status)] },
  })
  .run(
    (c) => c.newFlow<{ value: number }>().task(() => {}).build(),
    (_parent, item) => ({ value: item }),
  )
  .failFast()
  .join()
  .build();
```
