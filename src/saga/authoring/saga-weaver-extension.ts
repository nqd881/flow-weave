import { IFlowContext } from "../../contracts";
import { SagaDefMetadata } from "../saga-metadata";
import { SagaDefBuilder } from "./saga-def-builder";

export type SagaWeaverExtension = {
  saga<TContext extends IFlowContext = IFlowContext>(
    id?: string,
    metadata?: SagaDefMetadata<TContext>,
  ): SagaDefBuilder<any, TContext>;
};
