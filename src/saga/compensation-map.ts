import { IFlowExecutionContext } from "../abstraction";
import { Compensation } from "./compensation";

export class CompensationMap<
  TContext extends IFlowExecutionContext = IFlowExecutionContext,
> extends Map<string, Compensation<TContext>> {}
