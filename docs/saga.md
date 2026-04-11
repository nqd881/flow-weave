# Saga

Saga support extends regular flows with compensation logic.

## Saga Builder

Enable `sagaPlugin` and use `app.weaver().saga<TContext>()`.

`saga` accepts `SagaDefMetadata` as the second argument:

- `hooks`: flow-level step hooks inherited from `FlowDefMetadata`
- `compensatorStrategy`: compensation run strategy (`CompensatorStrategy` enum)

```ts
import {
  StepCompensationAction,
  CompensatorStrategy,
  FlowWeave,
  sagaPlugin,
} from "flow-weave";

type Ctx = { orderId: string };

const app = FlowWeave.create().use(sagaPlugin).build();
const weaver = app.weaver();

const releaseFunds: StepCompensationAction<Ctx> = async (ctx) => {
  console.log("release", ctx.orderId);
};

const refund: StepCompensationAction<Ctx> = async (ctx) => {
  console.log("refund", ctx.orderId);
};

const saga = weaver
  .saga<Ctx>("payment-saga", {
    compensatorStrategy: CompensatorStrategy.BestEffort,
  })
  .step("reserve")
  .task(() => {})
  .compensateWith(releaseFunds)
  .step("capture")
  .task(() => {})
  .compensateWith(refund)
  .commit()
  .build();
```

## How Compensation Is Registered

- `compensateWith(action)` applies to the most recently added step.
- During execution, completed steps can register compensations.
- Compensations execute in reverse order.
- Compensation strategy defaults to `"fail-fast"`.

## Commit/Pivot Step

- `commit()` marks a pivot point.
- Before commit: completed steps can add compensations.
- After commit: compensation registration stops for later completed steps.

## When Compensation Runs

Compensation runs when saga execution finishes as:

- `failed`
- `stopped`

and the saga is not committed.

## Nested Sagas In Parent Flows

When a saga is used as a child branch (for example inside a parent parallel step),
the child saga is treated as an isolated execution boundary.

- Child saga compensation is owned by the child saga itself.
- Parent saga does not inspect or reuse child internal compensations.
- Parent saga does not auto-compensate completed sibling child sagas when another child fails.

Practical outcome:

- A failed child saga can self-compensate.
- A sibling child saga that already completed remains completed unless you model an explicit parent-level recovery action.

## Runtime Pieces

- `SagaDef`: flow definition + compensation action map + optional pivot step id.
- `SagaExecution`: tracks committed state and invokes compensator on finish.
- `SagaExecutor`: hooks into step lifecycle to register compensation and commit.
