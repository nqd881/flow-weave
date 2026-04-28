import { IFlowDef } from "../../../src";
import { ChildFlow, Flow, ForEach, Task } from "../../../src/authoring/decorator";

declare const builtChildFlow: IFlowDef<{ events: string[] }>;

@Flow<{ item: number; events: string[] }>("decorated-item")
export class DecoratedItemFlow {
  declare static readonly flowDef: IFlowDef<{ item: number; events: string[] }>;

  @Task()
  static run(ctx: { item: number; events: string[] }) {
    ctx.events.push(`item:${ctx.item}`);
  }
}

@Flow<{ items: number[]; events: string[] }>("decorated-main")
export class DecoratedMainFlow {
  declare static readonly flowDef: IFlowDef<{ items: number[]; events: string[] }>;

  @Task()
  static start(ctx: { items: number[]; events: string[] }) {
    ctx.events.push("start");
  }

  @ChildFlow(builtChildFlow)
  static builtChild: void;

  @ForEach(
    (ctx: { items: number[]; events: string[] }) => ctx.items,
    DecoratedItemFlow,
  )
  static adaptItem(ctx: { items: number[]; events: string[] }, item: number) {
    return { item, events: ctx.events };
  }
}
