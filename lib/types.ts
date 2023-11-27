import { EventType } from "./constants"

export type EventCallback = (event: VGGEvent) => Promise<void>

/**
 * Event listeners registered with the event manager
 */
export interface VGGEventListener {
  type: EventType
  callback: EventCallback
}

export interface VGGEvent {
  type: EventType
  data?: string | string[] | number
}

export interface VGGWasmInstance {
  ccall: (
    ident: string,
    returnType: string,
    argTypes: string[],
    args: any[]
  ) => any
  VggSdk: {
    new (): VggSdkType
  }
}

/**
 * Dependency Injector Container
 */
export interface DIContainer {
  vggSetObject(key: string, value: object): void
  vggGetObject(key: string): object | undefined
}

type NativeEventType =
  | "keydown"
  | "keyup"
  | "auxclick"
  | "click"
  | "contextmenu"
  | "dblclick"
  | "mousedown"
  | "mouseenter"
  | "mouseleave"
  | "mousemove"
  | "mouseout"
  | "mouseover"
  | "mouseup"
  | "touchcancel"
  | "touchend"
  | "touchmove"
  | "touchstart"
type EventListenerItem = {
  type: NativeEventType
  listener: string
}
interface EventListners {
  EventType?: Array<EventListenerItem>
}

export interface VggSdkType {
  // addObserver(observer: VggSdkObserver): void;

  getEnvKey(): string
  getDesignDocument(): string

  addAt(path: string, value: string): void
  deleteAt(path: string): void
  updateAt(path: string, value: string): void

  addEventListener(path: string, type: string, code: string): void
  removeEventListener(path: string, type: string, code: string): void
  getEventListeners(path: string): EventListners
}

declare global {
  interface Window {
    _vgg_createWasmInstance: any
  }
}
