# Extensibility

This page describes practical extension patterns with the current architecture.

## 0) FlowWeave App Plugins

`FlowWeave` is the primary extension surface.

```ts
import { FlowWeave, sagaPlugin } from "flow-weave";

const app = FlowWeave.create()
  .use(sagaPlugin)
  .build();

const weaver = app.weaver();
const runtime = app.runtime();
```

## 1) Extend Builder DSL

You can create your own builder subclass and add fluent methods.

Typical use:

- convenience wrappers around existing methods (`task`, `switchOn`, etc.)
- domain-specific naming (`httpCall`, `reserveInventory`, `notifyUser`)

Example sketch:

```ts
import { FlowDefBuilder, IFlowContext } from "flow-weave";

class AppFlowBuilder<TAuthor, TContext extends IFlowContext>
  extends FlowDefBuilder<TAuthor, TContext> {
  audit(message: string) {
    return this.task((ctx: any) => {
      ctx.logs?.push(message);
    });
  }
}
```

## 2) Custom Step Types

If you add custom step definitions, you also need runtime support.

Why:

- flow execution resolves executors by step type
- unknown step types cannot run without executor resolution

So custom step types are a two-part change:

1. DSL and step definition type
2. executor/runtime wiring

Register executor wiring on a flow runtime:

  ```ts
  import {
  CoreFlowRuntime,
  IStepExecution,
  IStepExecutor,
  RuntimeBuilder,
  StepDef,
} from "flow-weave";

class HttpStepDef extends StepDef<{ url: string }> {}

class HttpStepExecutor implements IStepExecutor<HttpStepDef> {
  async execute(stepExecution: IStepExecution<HttpStepDef>) {
    await fetch(stepExecution.context.url);
  }
}

const runtime = new RuntimeBuilder()
  .withFlowRuntime(
    new CoreFlowRuntime().withStepExecutor(
      HttpStepDef,
      () => new HttpStepExecutor(),
    ),
  )
  .build();
```

If your custom step executor starts child flows, prefer `stepExecution.createChildFlowExecution(flowDef, context)` over manual `onStopRequested(...)` wiring.
That helper delegates to the runtime and links parent-step-to-child-flow stop propagation automatically.

## 3) Flow Runtime Composition

`Runtime` routes execution to a flow runtime by flow kind.

- register flow runtimes via `RuntimeBuilder.withFlowRuntime(flowRuntime)`
- create flows with matching `kind`

This makes custom flow kinds possible with a custom flow runtime.
Treat the flow runtime as the primary public seam. It owns flow execution creation, step execution creation, and step executor resolution for that flow family.
Custom flow runtimes should create runtime-native execution implementations (or subclasses of them) instead of wrapping `IFlowExecution` / `IStepExecution` with unrelated proxy objects. Nested child-flow and step creation now rely on constructor-time parent injection inside those native execution implementations.

If you implement a custom `IFlowExecutor`, prefer `flowExecution.createStepExecution(stepDef)` over constructing `StepExecution` manually.
That keeps step executor resolution, flow hooks, and parent-child execution wiring centralized in the flow runtime and flow execution implementation.
If you need per-step custom behavior, implement a small custom `IFlowExecutor` that wraps `flowExecution.createStepExecution(stepDef)` rather than relying on extra executor policy layers.

## 4) Advanced Runtime APIs

For advanced plugin/runtime work, `flow-weave` also exposes runtime base classes:

- `BaseExecution`
- `FlowExecution`
- `StepExecution`
- `FlowExecutor`
- `BaseFlowRuntime`
- `CoreFlowRuntime`

These are not required for normal authoring or custom leaf step executors.
They are intended for advanced cases where you want to build flow-runtime-backed plugins the way saga support does.

Guidance:

- use contracts like `IStepExecutor` and `IStepExecution` first
- reach for `StepExecution` / `FlowExecution` only when you need custom execution lifecycle behavior
- prefer subclassing the provided runtime-native execution classes over wrapping `IFlowExecution` / `IStepExecution` with unrelated proxy objects

## 5) Recommended Strategy

Start simple:

1. Extend builder DSL first.
2. Reuse built-in step types when possible.
3. Add custom step execution only when built-ins are not enough.
