import { IFlowExecutionContext, StepDefId } from "../abstraction";
import { Compensation } from "./compensation";

export class CompensationMap<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
> extends Map<StepDefId, Compensation<TContext>> {}
