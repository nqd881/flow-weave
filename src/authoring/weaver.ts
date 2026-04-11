import { IFlowContext } from "../contracts";
import { FlowDefMetadata } from "../flow";
import { FlowDefBuilder } from "./flow-def-builder";

export class Weaver {
  flow<TContext extends IFlowContext = IFlowContext>(
    id?: string,
    metadata?: FlowDefMetadata<TContext>,
  ) {
    return new FlowDefBuilder<typeof this, TContext>(this, id, metadata);
  }
}
