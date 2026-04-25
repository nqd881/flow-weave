export interface IStopControl {
  requestStop(): void;
  isStopRequested(): boolean;
  onStopRequested(action: () => any): void;
}
