import { IFlowContext } from "../contracts";
import { SagaDefBuilder } from "./saga-def-builder";
import { SagaDefMetadata } from "./saga-metadata";

export type SagaWeaverExtension = {
  saga<TContext extends IFlowContext = IFlowContext>(
    id?: string,
    metadata?: SagaDefMetadata<TContext>,
  ): SagaDefBuilder<any, TContext>;
};
