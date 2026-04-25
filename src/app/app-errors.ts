import { FlowDefId } from "../contracts";

export class FlowNotFoundError extends Error {
  constructor(flowId: FlowDefId) {
    super(`Flow '${flowId}' not found in app registry.`);
  }
}
