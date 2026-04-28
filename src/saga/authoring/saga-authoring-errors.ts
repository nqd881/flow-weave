import { AuthoringError } from "../../authoring/authoring-error";

export class NoStepToCompensateError extends AuthoringError {
  constructor() {
    super("No step to compensate.");
  }
}
