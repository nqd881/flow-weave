import { IFlowExecutionContext, IStepDef } from "../abstraction";
import { FlowDef } from "../base";
import { CompensationMap } from "./compensation-map";

export class SagaDef<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
> extends FlowDef<TContext> {
  static readonly type = "saga";

  public readonly compensationMap: CompensationMap<TContext>;
  public readonly pivotStepId?: string;

  constructor(
    steps: IStepDef<TContext>[],
    compensationMap: CompensationMap<TContext>,
    pivotStepId?: string,
  ) {
    super(steps);

    this.compensationMap = compensationMap;
    this.pivotStepId = pivotStepId;
  }
}
