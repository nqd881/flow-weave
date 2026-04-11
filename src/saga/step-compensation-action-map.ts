import { IFlowContext, StepDefId } from "../contracts";
import { StepCompensationAction } from "./step-compensation";

export class StepCompensationActionMap<
  TContext extends IFlowContext = IFlowContext,
> extends Map<StepDefId, StepCompensationAction<TContext>> {}
