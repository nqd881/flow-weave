import { IStepDef } from "./step-def";
import { IStepExecution } from "./step-execution";

export type StepDefCtor<TStep extends IStepDef = IStepDef> = new (
  ...args: any[]
) => TStep;

export type StepExecutorFactory<TStep extends IStepDef = IStepDef> = () =>
  IStepExecutor<TStep>;

export interface IStepExecutor<TStep extends IStepDef> {
  execute(stepExecution: IStepExecution<TStep>): Promise<any>;
}
