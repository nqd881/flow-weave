import type { IStepDef } from "../../contracts";

export interface IStepDefBuilder<TStep extends IStepDef = IStepDef> {
  build(): TStep;
}
