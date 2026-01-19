import { v4 } from "uuid";
import {
  CONTEXT_TYPE,
  IFlowDef,
  IFlowExecutionContext,
  IStepDef,
} from "../abstraction";
import { FlowDefBuilder, IFlowBuilderClient } from "./flow-def-builder";

export class FlowDef<
  TContext extends IFlowExecutionContext = IFlowExecutionContext
> implements IFlowDef<TContext>
{
  readonly [CONTEXT_TYPE]!: TContext;

  static builder(client: IFlowBuilderClient) {
    return new FlowDefBuilder(client);
  }

  public readonly id: string;

  constructor(public readonly steps: IStepDef<TContext>[]) {
    this.id = v4();
  }
}
