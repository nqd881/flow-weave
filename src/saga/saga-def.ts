import { FlowDefId, IFlowContext, IStepDef } from "../contracts";
import { FlowDef } from "../flow";
import { StepCompensationActionMap } from "./step-compensation-action-map";
import { CompensatorStrategy } from "./compensator";
import { SagaDefMetadata } from "./saga-metadata";

export class SagaDef<
  TContext extends IFlowContext = IFlowContext,
> extends FlowDef<TContext> {
  static readonly flowKind = SagaDef;

  public readonly stepCompensationActionMap: StepCompensationActionMap<TContext>;
  public readonly pivotStepId?: string;
  public readonly compensatorStrategy: NonNullable<
    SagaDefMetadata<TContext>["compensatorStrategy"]
  >;

  constructor(
    id: FlowDefId,
    steps: IStepDef<TContext>[],
    stepCompensationActionMap: StepCompensationActionMap<TContext>,
    pivotStepId?: string,
    metadata?: SagaDefMetadata<TContext>,
  ) {
    super(id, steps, metadata);

    this.stepCompensationActionMap = stepCompensationActionMap;
    this.pivotStepId = pivotStepId;
    this.compensatorStrategy =
      metadata?.compensatorStrategy ?? CompensatorStrategy.FailFast;
  }
}
