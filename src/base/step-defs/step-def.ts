import {
  CONTEXT_TYPE,
  IFlowExecutionContext,
  IStepDef,
} from "../../abstraction";
import { v4 } from "uuid";

export class StepDef<
  TContext extends IFlowExecutionContext = IFlowExecutionContext
> implements IStepDef<TContext>
{
  readonly [CONTEXT_TYPE]: TContext;

  constructor(public readonly id: string = v4()) {}
}
