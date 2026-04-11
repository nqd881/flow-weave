import { IFlowContext } from "../contracts";
import { FlowDefMetadata } from "../flow";
import { CompensatorRunOptions } from "./compensator";

export type SagaDefMetadata<
  TContext extends IFlowContext = IFlowContext,
> = FlowDefMetadata<TContext> & {
  compensatorStrategy?: CompensatorRunOptions["runStrategy"];
};
