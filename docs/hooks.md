# Hooks

This page documents hook APIs, execution order, and error behavior.

## Hook Layers

`flow-weave` has two public hook layers:

- flow hooks (`flow(..., { hooks })`, and plugin-provided `saga(..., { hooks })`)
- step hooks (`task(...).hooks(...)`, and composite builder `.hooks(...)` methods)

Executor-side per-step behavior is separate from the public flow/step hook API and should be modeled in a custom `IFlowExecutor` when needed.

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
    status: ExecutionStatus;
    outcome?: StepExecutionOutcome;
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
    post: [(_ctx, { stepId, status, outcome }) => console.log("post", stepId, status, outcome?.kind)],
  })
  .build();
```

`status` is lifecycle state:

- `pre` hooks observe `running`
- `post` hooks observe `running`

`outcome` is the step's raw logical result before post-hook finalization.
It is resolved before `post` hooks run, while the step is still `running`.
The step becomes `finished` only after `post` hooks complete.
Use the concrete outcome class to inspect failure details such as `error`, `cause`, or `failureSource`.

`hooks()`, `preHooks()`, and `postHooks()` target the current pending step draft on the parent flow builder.
For composite steps, call these methods after returning to the parent builder with `join()`, `end()`, or `run(...)`.
Calling `step(id)` closes the current pending draft and prepares the next step id, so hook methods are invalid until another step is declared.

## Execution Order

Per step, the lifecycle order is:

1. flow `pre`
2. step `pre`
3. step executor logic
4. step `post`
5. flow `post`

Retry and recovery do not change the hook count for a logical step:

- `pre` hooks run once before the first attempt
- `post` hooks run once after the final logical outcome
- intermediate retry failures do not trigger extra normal hook runs

## Error Behavior

- `pre` hook throws: step fails immediately, step executor is not run
- `post` hooks run in `finally`, including failed/stopped steps and steps that trigger loop break control flow
- if executor throws and post hook also throws, executor error stays primary
- if executor succeeds and post throws, step execution rejects with the post-hook error but the step outcome remains the resolved core outcome
- if `recover(...)` handles a final step failure, post hooks observe `outcome.kind === "recovered"`
- if a retried step still fails, `post` hooks observe only the final failed outcome

`break()` is control flow, not a public outcome kind. Post hooks for a breaking step still observe a running step with `completed` outcome before the break signal continues to the enclosing loop.

`getError()` reports the terminal primary error for the step execution. A post-hook error becomes that error only when there is no earlier primary failure or control signal.

## Which Hook Should I Use?

- flow hooks: cross-cutting behavior for one flow script
- step hooks: behavior specific to one step
- use `post` hooks for side effects after final failed retry outcomes
- use `recover(...)` only when the flow should continue after final failure
