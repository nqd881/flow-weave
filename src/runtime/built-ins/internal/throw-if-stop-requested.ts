import { IStopControl } from "../../../contracts";
import { StopSignal } from "../../execution-signals";

export function throwIfStopRequested(stopControl: IStopControl) {
  if (stopControl.isStopRequested()) {
    throw new StopSignal();
  }
}
