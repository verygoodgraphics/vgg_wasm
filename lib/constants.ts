/**
 * Supported event types triggered in VGG
 */
export enum EventType {
  Load = "load",
  LoadError = "loaderror",
  StateChange = "statechange",
  OnClick = "onclick",
}

export enum State {
  Loading = "loading",
  Ready = "ready",
  Error = "error",
}
