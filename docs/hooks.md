# Hooks

This page documents hook APIs, execution order, and error behavior.

## Hook Layers

`flow-weave` has three hook layers with different ownership:

- engine lifecycle hooks (`beforeStepStart`, `afterStepFinished`)
- flow hooks (`newFlow(..., { hooks })`, `newSaga(..., { hooks })`)
- step hooks (`task(..., { hooks })`, and other step methods with options)

## API Surface

Step and flow hooks both use `pre` and `post`.

```ts
type Hooks<TContext> = {
  pre?: StepHook<TContext>[];
  post?: StepHook<TContext>[];
};

type StepHook<TContext> = (
  context: TContext,
  info: {
    stepId: string;
    stepType: string;
    status: StepExecutionStatus;
    error?: unknown;
  },
) => any | Promise<any>;
```

## Examples

Flow-level hooks:

```ts
const flow = builder.newFlow<{ value: number }>("flow-id", {
  hooks: {
    pre: [() => console.log("flow-pre")],
    post: [() => console.log("flow-post")],
  },
});
```

Step-level hooks:

```ts
builder
  .newFlow<{ value: number }>()
  .step("charge")
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

## Execution Order

Per step, the lifecycle order is:

1. engine `beforeStepStart`
2. flow `pre`
3. step `pre`
4. step executor logic
5. step `post`
6. flow `post`
7. engine `afterStepFinished`

## Error Behavior

- `pre` hook throws: step fails immediately, step executor is not run
- `post` hooks run in `finally`, including failed/stopped steps
- if executor throws and post hook also throws, executor error stays primary
- if executor succeeds and post throws, step fails with post error

## Which Hook Should I Use?

- engine hooks: framework/runtime concerns (internal policies, saga orchestration)
- flow hooks: cross-cutting behavior for one flow script
- step hooks: behavior specific to one step
