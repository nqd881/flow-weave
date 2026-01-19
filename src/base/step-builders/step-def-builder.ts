import type { IStepDef } from "../../abstraction";

export interface IStepDefBuilder<TStep extends IStepDef = IStepDef> {
  build(): TStep;
}
