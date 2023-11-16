export interface VGGProps {
  canvas: HTMLCanvasElement | OffscreenCanvas
  src: string
  runtime?: string
  onLoad?: EventCallback
  onLoadError?: EventCallback
  onStateChange?: EventCallback
}

enum State {
  Loading = "loading",
  Ready = "ready",
  Error = "error",
}

export interface VGGWasmInstance {
  ccall: (
    ident: string,
    returnType: string,
    argTypes: string[],
    args: any[]
  ) => any
}

declare global {
  interface Window {
    _vgg_createWasmInstance: any
  }
}

// Canvas renderer
export class VGG {
  private defaultRuntime: string =
    "https://s5.vgg.cool/runtime/latest/vgg_runtime.js"

  // Canvas in which to render the artboard
  private readonly canvas: HTMLCanvasElement | OffscreenCanvas

  private width: number = 0
  private height: number = 0
  private editMode: boolean = false

  // A url to a Daruma file
  private src: string

  // The Wasm runtime
  private runtime: string

  // Holds event listeners
  private eventManager: EventManager

  private state: State = State.Loading

  private vggWasmInstance: VGGWasmInstance | null = null

  // Error message for missing source
  private static readonly missingErrorMessage: string =
    "Daruma source file required"

  constructor(props: VGGProps) {
    console.log("VGGCanvas")
    this.canvas = props.canvas
    this.src = props.src
    this.runtime = props.runtime || this.defaultRuntime
    this.width = this.canvas?.width ?? 0
    this.height = this.canvas?.height ?? 0

    // New event management system
    this.eventManager = new EventManager()
    if (props.onLoad) this.on(EventType.Load, props.onLoad)
    if (props.onLoadError) this.on(EventType.LoadError, props.onLoadError)
    if (props.onStateChange) this.on(EventType.StateChange, props.onStateChange)

    this.init({ ...props })
  }

  private init({ src }: VGGProps) {
    this.src = src
    this.insertScript(this.runtime)

    if (!this.src) {
      throw new Error(VGG.missingErrorMessage)
    }

    requestAnimationFrame(() => this.checkState())
  }

  private async checkState() {
    if (window._vgg_createWasmInstance) {
      const wasmInstance = await window._vgg_createWasmInstance({
        noInitialRun: true,
        canvas: this.canvas,
        locateFile: function (path: string, prefix: string) {
          if (path.endsWith(".data")) {
            return "https://s5.vgg.cool/runtime/latest/" + path
          }
          return prefix + path
        },
      })

      if (wasmInstance) {
        this.vggWasmInstance = wasmInstance
        this.state = State.Ready
        this.eventManager.fire({ type: EventType.Load })
      } else {
        this.state = State.Error
        this.eventManager.fire({ type: EventType.LoadError })
      }
    } else {
      requestAnimationFrame(() => this.checkState())
    }
  }

  private insertScript(src: string) {
    const script = document.createElement("script")
    script.src = src
    document.head.appendChild(script)
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

  public async run(
    darumaUrl?: string,
    opts?: {
      width: number
      height: number
      editMode?: boolean
    }
  ) {
    this.width = opts?.width ?? this.width
    this.height = opts?.height ?? this.height
    this.editMode = opts?.editMode ?? this.editMode

    console.log("run")
    if (!this.vggWasmInstance) {
      throw new Error("VGG Wasm instance not ready")
    }

    try {
      this.vggWasmInstance.ccall(
        "emscripten_main",
        "void",
        ["number", "number", "boolean"],
        [this.width, this.height, this.editMode]
      )
    } catch (err) {
      console.error(err)
    }

    const res = await fetch(this.src)
    if (!res.ok) throw new Error("Failed to fetch Daruma file")
    const buffer = await res.arrayBuffer()
    const data = new Int8Array(buffer)
    if (
      !this.vggWasmInstance.ccall(
        "load_file_from_mem",
        "boolean", // return type
        ["string", "array", "number"], // argument types
        ["name", data, data.length]
      )
    ) {
      throw new Error("Failed to load Daruma file")
    }
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
