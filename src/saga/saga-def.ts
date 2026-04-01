import { IFlowExecutionContext, IStepDef } from "../abstraction";
import { FlowDef, FlowOptions } from "../base";
import { CompensationMap } from "./compensation-map";

export class SagaDef<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
> extends FlowDef<TContext> {
  static readonly kind = SagaDef;

  public readonly compensationMap: CompensationMap<TContext>;
  public readonly pivotStepId?: string;

  constructor(
    steps: IStepDef<TContext>[],
    compensationMap: CompensationMap<TContext>,
    pivotStepId?: string,
    options?: FlowOptions<TContext>,
  ) {
    super(steps, undefined, options);

    this.compensationMap = compensationMap;
    this.pivotStepId = pivotStepId;
  }
}
