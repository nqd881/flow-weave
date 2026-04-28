import { Task } from "../../../src/authoring/decorator";
import {
  CommitPoint,
  CompensateWith,
  Saga,
  SagaDef,
} from "../../../src/saga";

export const compensateCharge = (ctx: { events: string[] }) => {
  ctx.events.push("undo-charge");
};

@Saga<{ events: string[] }>("decorated-saga")
export class DecoratedSagaFlow {
  declare static readonly flowDef: SagaDef<{ events: string[] }>;

  @Task()
  @CompensateWith(compensateCharge)
  static charge(ctx: { events: string[] }) {
    ctx.events.push("charge");
  }

  @Task()
  @CommitPoint()
  static confirm(ctx: { events: string[] }) {
    ctx.events.push("confirm");
  }
}

@Saga<{ events: string[] }>("decorated-saga-runtime")
export class DecoratedSagaRuntimeFlow {
  declare static readonly flowDef: SagaDef<{ events: string[] }>;

  @Task()
  @CompensateWith((ctx: { events: string[] }) => {
    ctx.events.push("compensate-charge");
  })
  static charge(ctx: { events: string[] }) {
    ctx.events.push("charge");
  }

  @Task()
  static fail() {
    throw new Error("decorated-saga-fail");
  }
}
