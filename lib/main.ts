import { EventCallback, VGGWasmInstance, VggSdkType } from "./types"
import { EventType, State } from "./constants"
import { EventManager } from "./events"
export { EventType } from "./constants"

export interface VGGProps {
  canvas: HTMLCanvasElement | OffscreenCanvas
  src: string
  runtime?: string
  editMode?: boolean
  verbose?: boolean
  dicUrl?: string
  onLoad?: EventCallback
  onLoadError?: EventCallback
  onStateChange?: EventCallback
  onClick?: EventCallback
}

// Canvas renderer
export class VGG {
  readonly props: VGGProps

  private defaultRuntime: string = "https://s5.vgg.cool/runtime/latest"

  // Canvas in which to render the artboard
  private readonly canvas: HTMLCanvasElement | OffscreenCanvas

  private width: number = 0
  private height: number = 0
  private editMode: boolean = false

  // Verbose logging
  private verbose: boolean

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

  private verboseElement: HTMLDivElement | null = null

  private observables: Map<string, any> = new Map()

  constructor(props: VGGProps) {
    console.log("VGGCanvas")
    this.props = props
    this.canvas = props.canvas
    this.src = props.src
    this.runtime = props.runtime || this.defaultRuntime
    this.width = this.canvas?.width ?? 0
    this.height = this.canvas?.height ?? 0
    this.editMode = props.editMode ?? false
    this.verbose = props.verbose ?? false

    // New event management system
    this.eventManager = new EventManager()
    if (props.onLoad) this.on(EventType.Load, props.onLoad)
    if (props.onLoadError) this.on(EventType.LoadError, props.onLoadError)
    if (props.onStateChange) this.on(EventType.StateChange, props.onStateChange)
    if (props.onClick) this.on(EventType.OnClick, props.onClick)

    try {
      this.init({ ...props })
    } catch (err: any) {
      this.eventManager.fire({ type: EventType.LoadError, data: err.message })
    }
  }

  private init({ src }: VGGProps) {
    this.src = src
    this.insertScript(this.runtime + "/vgg_runtime.js")

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
    const runtime = this.runtime
    if (window._vgg_createWasmInstance) {
      const wasmInstance: VGGWasmInstance =
        await window._vgg_createWasmInstance({
          noInitialRun: true,
          canvas: this.canvas,
          locateFile: function (path: string, prefix: string) {
            if (path.endsWith(".data")) {
              return runtime + "/" + path
            }
            return prefix + path
          },
        })

      if (wasmInstance) {
        this.vggWasmInstance = wasmInstance
        this.state = State.Ready

        try {
          console.log("emscripten_main", this.width, this.height, this.editMode)
          // TODO: caused unwind error when calling emscripten_main
          this.vggWasmInstance.ccall(
            "emscripten_main",
            "void",
            ["number", "number", "boolean"],
            [this.width, this.height, this.editMode]
          )
        } catch (err) {
          console.error(err)
        }

        // Load the VGG SDK
        this.vggSdk = new wasmInstance.VggSdk()

        console.log("vggSdk", this.vggSdk)
        // debugger

        // Mount the wasmInstance to GlobalThis
        // @ts-expect-error
        const globalVggInstances = globalThis["vggInstances"] ?? {}
        const vggInstanceKey = this.vggSdk.getEnvKey()

        if (this.props.onClick) {
          // if onClick is defined, add event listener
          Object.assign(globalVggInstances, {
            [vggInstanceKey]: {
              instance: wasmInstance,
              listener: (event: any) => {
                console.log("onClick", event)
                // this.eventManager.fire({
                //   type: EventType.OnClick,
                //   data: event,
                // })
              },
            },
          })
        }

        // @ts-expect-error
        globalThis["vggInstances"] = globalVggInstances

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

    // render verbose logs
    if (this.verbose) {
      this.verboseElement = document.createElement("div")
      this.verboseElement.classList.add("vgg-verbose")
      this.verboseElement.style.position = "fixed"
      this.verboseElement.style.top = "16px"
      this.verboseElement.style.right = "16px"
      this.verboseElement.style.width = "240px"
      this.verboseElement.style.height = "360px"
      this.verboseElement.style.overflow = "auto"
      this.verboseElement.style.backgroundColor = "white"
      this.verboseElement.style.zIndex = "9999"
      this.verboseElement.style.padding = "20px"
      this.verboseElement.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)"
      this.verboseElement.style.fontFamily = "monospace"
      this.verboseElement.style.fontSize = "12px"
      this.verboseElement.style.lineHeight = "1.5"
      this.verboseElement.style.color = "black"
      this.verboseElement.style.borderRadius = "10px"

      this.verboseElement.innerHTML = `
        <h2>Verbose</h2>
        <pre></pre>
      `

      document.body.appendChild(this.verboseElement)

      console.log("Verbose logging enabled")
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
      const docString = this.vggSdk?.getDesignDocument()
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

  public $(selector: string) {
    if (!this.vggSdk) {
      throw new Error("VGG SDK not ready")
    }
    const isExist = this.observables.get(selector)
    if (!isExist) {
      const newObservable = new Object()
      this.observables.set(selector, newObservable)
      return newObservable
    }
    return isExist
  }
}
