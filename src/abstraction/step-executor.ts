import { IStepDef } from "./step-def";
import { IStepExecution } from "./step-execution";

export interface IStepExecutor<TStep extends IStepDef> {
  execute(stepExecution: IStepExecution<TStep>): Promise<any>;
}
