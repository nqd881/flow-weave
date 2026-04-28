# Hooks

`flow-weave` exposes two public hook layers:

- flow hooks
- step hooks

Hook behavior is runtime-level and is the same for builder-authored and decorator-authored flows.

## Flow Hooks

Builder example:

```ts
const flow = builder.flow<{ value: number }>("flow-id", {
  hooks: {
    pre: [() => console.log("flow-pre")],
    post: [() => console.log("flow-post")],
  },
});
```

Decorator-authored flows still use flow metadata on the class decorator input:

```ts
import { IFlowDef } from "flow-weave";

@Flow<{ value: number }>("flow-id", {
  hooks: {
    pre: [() => console.log("flow-pre")],
    post: [() => console.log("flow-post")],
  },
})
class MyFlow {
  declare static readonly flowDef: IFlowDef<{ value: number }>;
}
```

## Step Hooks

Builder example:

```ts
builder
  .flow<{ value: number }>()
  .task((ctx) => {
    ctx.value += 1;
  })
  .hooks({
    pre: [(_ctx, { stepId }) => console.log("pre", stepId)],
    post: [(_ctx, { stepId, outcome }) => console.log("post", stepId, outcome?.kind)],
  })
  .build();
```

Decorator example:

```ts
import { IFlowDef } from "flow-weave";

@Flow<{ value: number }>("flow-id")
class MyFlow {
  declare static readonly flowDef: IFlowDef<{ value: number }>;

  @Task()
  @PreHook((_ctx, { stepId }) => console.log("pre", stepId))
  @PostHook((_ctx, { stepId, outcome }) => console.log("post", stepId, outcome?.kind))
  static run(ctx: { value: number }) {
    ctx.value += 1;
  }
}
```

## Execution Order

Per logical step, the lifecycle order is:

1. flow `pre`
2. step `pre`
3. step executor logic
4. step `post`
5. flow `post`

Retry and recovery do not create extra normal hook cycles.

- `pre` hooks run once before the first attempt
- `post` hooks run once after the final logical outcome

## Error Behavior

- `pre` hook throws: step fails immediately
- `post` hooks still run for failed/stopped steps and loop-break control flow
- if executor throws and post hook also throws, executor error stays primary
- if executor succeeds and post throws, the step rejects with the post-hook error
- recovered steps expose `outcome.kind === "recovered"` to post hooks

`break()` is control flow, not a public outcome kind.

## When To Use Which Layer

- flow hooks: cross-cutting behavior for one flow script
- step hooks: behavior specific to one step
- `recover(...)`: use only when the flow should continue after final failure
