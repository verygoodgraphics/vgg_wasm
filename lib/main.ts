export interface VGGProps {
  canvas: HTMLCanvasElement | OffscreenCanvas
  src: string
  runtime: string
  onLoad?: EventCallback
  onLoadError?: EventCallback
  onStateChange?: EventCallback
}

// Canvas renderer
export class VGG {
  // Canvas in which to render the artboard
  private readonly canvas: HTMLCanvasElement | OffscreenCanvas

  // A url to a Daruma file
  private src: string

  // The Wasm runtime
  private runtime: string

  // Holds event listeners
  private eventManager: EventManager

  // Error message for missing source
  private static readonly missingErrorMessage: string =
    "Daruma source file required"

  constructor(props: VGGProps) {
    console.log("VGGCanvas")
    this.canvas = props.canvas
    this.src = props.src
    this.runtime = props.runtime

    // New event management system
    this.eventManager = new EventManager()
    if (props.onLoad) this.on(EventType.Load, props.onLoad)
    if (props.onLoadError) this.on(EventType.LoadError, props.onLoadError)
    if (props.onStateChange) this.on(EventType.StateChange, props.onStateChange)

    this.init({ ...props })
  }

  private init({ src, runtime }: VGGProps) {
    this.src = src
    this.runtime = runtime

    if (!this.src) {
      throw new Error(VGG.missingErrorMessage)
    }
  }

  /**
   * Subscribe to VGG-generated events
   * @param type the type of event to subscribe to
   * @param callback callback to fire when the event occurs
   */
  public on(type: EventType, callback: EventCallback) {
    this.eventManager.add({
      type: type,
      callback: callback,
    })
  }
}

/**
 * Supported event types triggered in VGG
 */
export enum EventType {
  Load = "load",
  LoadError = "loaderror",
  StateChange = "statechange",
}

export type EventCallback = (event: Event) => void

/**
 * Event listeners registered with the event manager
 */
export interface EventListener {
  type: EventType
  callback: EventCallback
}

export interface Event {
  type: EventType
  data?: string | string[] | number
}

// Manages VGG events and listeners
class EventManager {
  constructor(private listeners: EventListener[] = []) {}

  // Gets listeners of specified type
  private getListeners(type: EventType): EventListener[] {
    return this.listeners.filter((e) => e.type === type)
  }

  // Adds a listener
  public add(listener: EventListener): void {
    if (!this.listeners.includes(listener)) {
      this.listeners.push(listener)
    }
  }

  /**
   * Removes a listener
   * @param listener the listener with the callback to be removed
   */
  public remove(listener: EventListener): void {
    // We can't simply look for the listener as it'll be a different instance to
    // one originally subscribed. Find all the listeners of the right type and
    // then check their callbacks which should match.
    for (let i = 0; i < this.listeners.length; i++) {
      const currentListener = this.listeners[i]
      if (currentListener.type === listener.type) {
        if (currentListener.callback === listener.callback) {
          this.listeners.splice(i, 1)
          break
        }
      }
    }
  }

  /**
   * Clears all listeners of specified type, or every listener if no type is
   * specified
   * @param type the type of listeners to clear, or all listeners if not
   * specified
   */
  public removeAll(type?: EventType) {
    if (!type) {
      this.listeners.splice(0, this.listeners.length)
    } else {
      this.listeners
        .filter((l) => l.type === type)
        .forEach((l) => this.remove(l))
    }
  }

  // Fires an event
  public fire(event: Event): void {
    const eventListeners = this.getListeners(event.type)
    eventListeners.forEach((listener) => listener.callback(event))
  }
}
