# Extensibility

This page covers the main extension seams in `flow-weave`.

## App Plugins

`FlowWeave` is the primary extension surface.

```ts
import { FlowWeave } from "flow-weave";
import { sagaPlugin } from "flow-weave/saga";

const app = FlowWeave.create().use(sagaPlugin).build();
```

## Extend The Builder DSL

Use `flow-weave/builder` when you want to extend the fluent API directly.

```ts
import { IFlowContext } from "flow-weave";
import { FlowDefBuilder } from "flow-weave/builder";

class AppFlowBuilder<TAuthor, TContext extends IFlowContext>
  extends FlowDefBuilder<TAuthor, TContext> {
  audit(message: string) {
    return this.task((ctx: any) => {
      ctx.logs?.push(message);
    });
  }
}
```

## Extend The Decorator Surface

Use `flow-weave/decorator` helper factories to build custom decorators.

```ts
import { StepDef, StepDefMetadata } from "flow-weave";
import { createStepDecorator } from "flow-weave/decorator";

class LabelStepDef extends StepDef {
  constructor(
    public readonly label: string,
    metadata?: StepDefMetadata,
  ) {
    super(metadata);
  }
}

const Label = createStepDecorator(
  (_pending, label: string) =>
    (metadata) => new LabelStepDef(label, metadata),
);
```

Related helpers:

- `createStepDecorator(...)`
- `createMethodStepDecorator(...)`
- `createSubDecorator(...)`

## Custom Step Types

If you add a custom step definition, you also need runtime executor support.

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

If your custom executor starts child flows, prefer `stepExecution.createChildFlowExecution(flowDef, context)` over manual stop wiring.

## Runtime Composition

`Runtime` routes execution by flow kind.

- register flow runtimes with `RuntimeBuilder.withFlowRuntime(...)`
- create flows with matching `flowKind`

Advanced runtime work can use:

- `BaseExecution`
- `FlowExecution`
- `StepExecution`
- `FlowExecutor`
- `BaseFlowRuntime`
- `CoreFlowRuntime`

Use contracts like `IStepExecutor` and `IStepExecution` first. Reach for the runtime base classes only when you need custom execution lifecycle behavior.
