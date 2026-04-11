import {
  StepCompensationAction,
  FlowWeave,
  SagaExecution,
  sagaPlugin,
} from "../src";

type CheckoutCtx = {
  orderId: string;
  inventoryReserved: boolean;
  paymentCharged: boolean;
  inventoryReleased: boolean;
  paymentRefunded: boolean;
  logs: string[];
};

const app = FlowWeave.create().use(sagaPlugin).build();
const weaver = app.weaver();
const runtime = app.runtime();

const releaseInventory: StepCompensationAction<CheckoutCtx> = async (ctx) => {
  ctx.inventoryReserved = false;
  ctx.inventoryReleased = true;
  ctx.logs.push("compensated:release-inventory");
  console.log("release inventory", ctx.orderId);
};

const refundPayment: StepCompensationAction<CheckoutCtx> = async (ctx) => {
  ctx.paymentCharged = false;
  ctx.paymentRefunded = true;
  ctx.logs.push("compensated:refund-payment");
  console.log("refund payment", ctx.orderId);
};

const checkoutSaga = weaver
  .saga<CheckoutCtx>("checkout-saga")
  .step("reserve-inventory")
  .task((ctx) => {
    ctx.inventoryReserved = true;
    ctx.logs.push("done:reserve-inventory");
    console.log("reserve inventory", ctx.orderId);
  })
  .compensateWith(releaseInventory)
  .step("charge-payment")
  .task((ctx) => {
    ctx.paymentCharged = true;
    ctx.logs.push("done:charge-payment");
    console.log("charge payment", ctx.orderId);
  })
  .compensateWith(refundPayment)
  .step("create-shipment")
  .task((ctx) => {
    ctx.logs.push("attempt:create-shipment");
    console.log("create shipment", ctx.orderId);
    throw new Error("shipping service unavailable");
  })
  .build();

async function main() {
  const execution = runtime.createFlowExecution(checkoutSaga, {
    orderId: "ORD-200",
    inventoryReserved: false,
    paymentCharged: false,
    inventoryReleased: false,
    paymentRefunded: false,
    logs: [],
  }) as unknown as SagaExecution;

  let failedAsExpected = false;

  try {
    await execution.start();
  } catch (error) {
    failedAsExpected = true;
    console.log("checkout saga failed", (error as Error).message);
  }

  if (!failedAsExpected) {
    throw new Error("Expected checkout saga to fail before completion.");
  }

  console.log("saga status", execution.getSagaStatus());
  console.log("final context", execution.context);
}

main().catch((error) => {
  console.error(error);
});
