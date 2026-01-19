import { CONTEXT_TYPE } from "./flow-def";
import { IFlowExecutionContext } from "./flow-execution-context";

export interface IStepDef<
  TContext extends IFlowExecutionContext = IFlowExecutionContext
> {
  readonly [CONTEXT_TYPE]: TContext;

  readonly id: string;
}
