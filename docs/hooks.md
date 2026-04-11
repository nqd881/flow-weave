# Hooks

This page documents hook APIs, execution order, and error behavior.

## Hook Layers

`flow-weave` has two public hook layers:

- flow hooks (`flow(..., { hooks })`, and plugin-provided `saga(..., { hooks })`)
- step hooks (`task(...).hooks(...)`, and composite builder `.hooks(...)` methods)

`FlowExecutor.beforeStepStart` and `FlowExecutor.afterStepFinished` are executor
extension points, not part of the flow/step hook API.

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
const flow = builder.flow<{ value: number }>("flow-id", {
  hooks: {
    pre: [() => console.log("flow-pre")],
    post: [() => console.log("flow-post")],
  },
});
```

Step-level hooks:

```ts
builder
  .flow<{ value: number }>()
  .step("charge")
  .task((ctx) => {
    ctx.value += 1;
  })
  .hooks({
    pre: [(_ctx, { stepId }) => console.log("pre", stepId)],
    post: [(_ctx, { stepId, status }) => console.log("post", stepId, status)],
  })
  .build();
```

`hooks()`, `preHooks()`, and `postHooks()` target the current simple step draft or the active composite step builder.
Calling `step(id)` closes the current simple step draft and prepares the next step id, so hook methods are invalid until another step is declared.

## Execution Order

Per step, the lifecycle order is:

1. flow `pre`
2. step `pre`
3. step executor logic
4. step `post`
5. flow `post`

## Error Behavior

- `pre` hook throws: step fails immediately, step executor is not run
- `post` hooks run in `finally`, including failed/stopped steps
- if executor throws and post hook also throws, executor error stays primary
- if executor succeeds and post throws, step fails with post error

## Which Hook Should I Use?

- flow hooks: cross-cutting behavior for one flow script
- step hooks: behavior specific to one step
