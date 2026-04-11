import { IFlowContext, StepDefId } from "../contracts";

export type StepCompensationAction<
  TContext extends IFlowContext = IFlowContext,
> = (context: TContext) => any;

export enum StepCompensationStatus {
  Registered = "registered",
  Completed = "completed",
  Failed = "failed",
}

export type StepCompensationResult = {
  stepId: StepDefId;
  status: StepCompensationStatus;
  error?: unknown;
};

export class StepCompensation<
  TContext extends IFlowContext = IFlowContext,
> {
  protected status: StepCompensationStatus = StepCompensationStatus.Registered;
  protected error?: unknown;

  constructor(
    public readonly stepId: StepDefId,
    public readonly action: StepCompensationAction<TContext>,
  ) {}

  getStatus() {
    return this.status;
  }

  getRunError() {
    return this.error;
  }

  async run(context: TContext): Promise<StepCompensationResult> {
    try {
      await Promise.resolve(this.action(context));

      this.error = undefined;
      this.status = StepCompensationStatus.Completed;
    } catch (error) {
      this.error = error;
      this.status = StepCompensationStatus.Failed;
    }

    return {
      stepId: this.stepId,
      status: this.status,
      error: this.error,
    };
  }
}
