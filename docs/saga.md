# Saga

Saga support extends regular flows with compensation logic.

## Saga Builder

Use `FlowBuilderClient.newSaga<TContext>()`.

```ts
import { FlowBuilderClient, Compensation } from "flow-weave";

type Ctx = { orderId: string };

const builder = new FlowBuilderClient();

const releaseFunds: Compensation<Ctx> = async (ctx) => {
  console.log("release", ctx.orderId);
};

const refund: Compensation<Ctx> = async (ctx) => {
  console.log("refund", ctx.orderId);
};

const saga = builder
  .newSaga<Ctx>("payment-saga")
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

## Commit/Pivot Step

- `commit()` marks a pivot point.
- Before commit: completed steps can add compensations.
- After commit: compensation registration stops for later completed steps.

## When Compensation Runs

Compensation runs when saga execution finishes as:

- `failed`
- `stopped`

and the saga is not committed.

## Runtime Pieces

- `SagaDef`: flow definition + compensation map + optional pivot step id.
- `SagaExecution`: tracks committed state and invokes compensator on finish.
- `SagaExecutor`: hooks into step lifecycle to register compensation and commit.
