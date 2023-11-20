import { EventCallback, VGGWasmInstance, VggSdkType } from "./types"
import { EventType, State } from "./constants"
import { EventManager } from "./events"
export { EventType } from "./constants"

export interface VGGProps {
  canvas: HTMLCanvasElement | OffscreenCanvas
  src: string
  runtime?: string
  editMode?: boolean
  dicUrl?: string
  onLoad?: EventCallback
  onLoadError?: EventCallback
  onStateChange?: EventCallback
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

  // Key to store the wasm instance in globalThis
  private vggWasmKey: string = "vggWasmKey"

  // Holds event listeners
  private eventManager: EventManager

  private state: State = State.Loading

  // The VGG Wasm instance
  private vggWasmInstance: VGGWasmInstance | null = null

  // The VGG SDK
  private vggSdk: VggSdkType | null = null

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
    this.editMode = props.editMode ?? false

    // New event management system
    this.eventManager = new EventManager()
    if (props.onLoad) this.on(EventType.Load, props.onLoad)
    if (props.onLoadError) this.on(EventType.LoadError, props.onLoadError)
    if (props.onStateChange) this.on(EventType.StateChange, props.onStateChange)

    try {
      this.init({ ...props })
    } catch (err: any) {
      this.eventManager.fire({ type: EventType.LoadError, data: err.message })
    }
  }

  private init({ src }: VGGProps) {
    this.src = src
    this.insertScript(this.runtime)

    // check if canvas is a valid element
    if (!this.canvas) {
      throw new Error("Canvas element required")
    }

    if (!this.src) {
      throw new Error(VGG.missingErrorMessage)
    }

    requestAnimationFrame(() => this.checkState())
  }

  private async checkState() {
    if (window._vgg_createWasmInstance) {
      const wasmInstance: VGGWasmInstance =
        await window._vgg_createWasmInstance({
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

        // Load the VGG SDK
        this.vggSdk = new wasmInstance.VggSdk()

        // Mount the wasmInstance to GlobalThis
        // @ts-expect-error
        const globalVggInstances = globalThis["vggInstances"]
        if (globalVggInstances) {
          globalVggInstances.set(this.vggWasmKey, wasmInstance)
        } else {
          // @ts-expect-error
          globalThis["vggInstances"] = new Map()
          // @ts-expect-error
          globalThis["vggInstances"].set(this.vggWasmKey, wasmInstance)
        }

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

  /**
   * Render the Daruma file
   * @param darumaUrl
   * @param opts
   */
  public async render(
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
      // console.error(err)
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

  public async getDesignDocument() {
    console.log(this.state)

    try {
      // TODO: Legacy -> 0 for normal, 1 for editor
      // @ts-ignore
      const docString = this.vggSdk?.getDesignDocument(0)
      if (!docString) {
        throw new Error("Failed to get design document")
      }
      const designDoc = JSON.parse(docString)
      console.log({ designDoc })
      return designDoc
    } catch (err) {
      console.log(err)
    }
    return null
  }
}
