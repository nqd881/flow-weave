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

Register executor wiring via `RuntimeBuilder.withStepExecutor(...)`:

```ts
import {
  FlowExecutionFactory,
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
  .withExecutionFactory(new FlowExecutionFactory())
  .withStepExecutor(HttpStepDef, () => new HttpStepExecutor())
  .build();
```

## 3) Execution Factory and Runtime Composition

`Runtime` routes execution to a factory by flow kind.

- register execution factories via `RuntimeBuilder.withExecutionFactory(factory)`
- create flows with matching `kind`

This makes custom flow kinds possible with a custom execution factory.

## 4) Recommended Strategy

Start simple:

1. Extend builder DSL first.
2. Reuse built-in step types when possible.
3. Add custom step execution only when built-ins are not enough.
