import { IFlowExecutionContext, IStepDef } from "../abstraction";
import { FlowDef } from "../base/flow-def";
import { IFlowBuilderClient } from "../base/flow-def-builder";
import { CompensationMap } from "./compensation-map";
import { SagaDefBuilder } from "./saga-def-builder";

export class SagaDef<
  TContext extends IFlowExecutionContext = IFlowExecutionContext
> extends FlowDef<TContext> {
  static builder(client: IFlowBuilderClient) {
    return new SagaDefBuilder(client);
  }

  public readonly compensationMap: CompensationMap;
  public readonly pivotStepId?: string;

  constructor(
    steps: IStepDef<TContext>[],
    compensationMap: CompensationMap,
    pivotStepId?: string
  ) {
    super(steps);

    this.compensationMap = compensationMap;
    this.pivotStepId = pivotStepId;
  }
}
