# Extensibility

This page describes practical extension patterns with the current architecture.

## 1) Extend Builder DSL

You can create your own builder subclass and add fluent methods.

Typical use:

- convenience wrappers around existing methods (`task`, `switchOn`, etc.)
- domain-specific naming (`httpCall`, `reserveInventory`, `notifyUser`)

Example sketch:

```ts
import { FlowDefBuilder, IFlowExecutionContext } from "flow-weave";

class AppFlowBuilder<TClient, TContext extends IFlowExecutionContext>
  extends FlowDefBuilder<TClient, TContext> {
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

## 3) Engine and Client Composition

`Client` routes execution to a flow engine by flow kind.

- register engines via `registerEngine(engine)`
- create flows with matching `kind`

This makes custom flow kinds possible with a custom engine.

## 4) Recommended Strategy

Start simple:

1. Extend builder DSL first.
2. Reuse built-in step types when possible.
3. Add custom step execution only when built-ins are not enough.
