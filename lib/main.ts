import { EventCallback, VGGWasmInstance, VggSdkType } from "./types"
import { EventType, State } from "./constants"
import { EventManager } from "./events"
export { EventType, State } from "./constants"
export type { VGGEvent } from "./types"

export interface VGGProps {
  canvas: HTMLCanvasElement | OffscreenCanvas
  src: string
  runtime?: string
  editMode?: boolean
  verbose?: boolean
  onLoad?: EventCallback
  onLoadError?: EventCallback
  onStateChange?: EventCallback
}

enum Colors {
  Red = "#EB0013",
  Green = "#1BA353",
  Yellow5 = "#f59e0b",
  Yellow8 = "#78350f",
}

export type VGGNode = {
  id: string
  path: string
}

// Canvas renderer
export class VGG<T extends string | number | symbol> {
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
  public vggInstanceKey: string = ""

  // Holds event listeners
  private eventManager: EventManager

  public state: State = State.Loading

  // The VGG Wasm instance
  private vggWasmInstance: VGGWasmInstance | null = null

  // The VGG SDK
  private vggSdk: VggSdkType | null = null

  // Error message for missing source
  private static readonly missingErrorMessage: string =
    "Daruma source file required"

  private observables: Map<string, any> = new Map()

  private requestAnimationFrame: any

  private VGGNodes = {} as Record<T, VGGNode>

  constructor(props: VGGProps) {
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
  }

  public async load() {
    try {
      await this.init({ ...this.props })
      // await this.getDesignDocument()
    } catch (err: any) {
      this.eventManager.fire({ type: EventType.LoadError, data: err.message })
    }
  }

  private async init({ src }: VGGProps) {
    this.src = src
    this.insertScript(this.runtime + "/vgg_runtime.js")

    // check if canvas is a valid element
    if (!this.canvas) {
      throw new Error("Canvas element required")
    }

    if (!this.src) {
      throw new Error(VGG.missingErrorMessage)
    }

    return new Promise((resolve) => {
      this.requestAnimationFrame = requestAnimationFrame(() =>
        this.checkState(resolve)
      )
    })
  }

  private async checkState(resolve: (value: unknown) => void) {
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

        try {
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

        // Mount the wasmInstance to GlobalThis
        // @ts-expect-error
        const globalVggInstances = globalThis["vggInstances"] ?? {}
        this.vggInstanceKey = this.vggSdk.getEnvKey()

        if (this.editMode) {
          // if onClick is defined, add event listener
          Object.assign(globalVggInstances, {
            [this.vggInstanceKey]: {
              instance: wasmInstance,
              listener: (event: any) => {
                const parsedEvent = JSON.parse(event)

                if (this.verbose) {
                  console.log(
                    `%cVGGEvent::${parsedEvent.type}`,
                    `background: ${Colors.Yellow5}; color: ${Colors.Yellow8}; font-weight: bold; border-radius: 2px; padding: 0 2.5px;`,
                    parsedEvent.id
                      ? `${parsedEvent.id} → ${parsedEvent.path}`
                      : ""
                  )
                }

                if (parsedEvent.type === "select") {
                  this.observables.get(parsedEvent.path)?.next("click")
                }
              },
            },
          })
        } else {
          Object.assign(globalVggInstances, {
            [this.vggInstanceKey]: {
              instance: wasmInstance,
            },
          })
        }

        // @ts-expect-error
        globalThis["vggInstances"] = globalVggInstances

        this.state = State.Ready
        this.eventManager.fire({ type: EventType.Load })
      } else {
        this.state = State.Error
        this.eventManager.fire({ type: EventType.LoadError })
      }

      // clear requestAnimationFrame
      cancelAnimationFrame(this.requestAnimationFrame)
      resolve(true)
    } else {
      requestAnimationFrame(() => this.checkState(resolve))
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
  ): Promise<{
    nodes: Record<T, VGGNode>
  }> {
    this.width = opts?.width ?? this.width
    this.height = opts?.height ?? this.height
    this.editMode = opts?.editMode ?? this.editMode

    if (!this.vggWasmInstance) {
      throw new Error("VGG Wasm instance not ready")
    }

    const res = await fetch(darumaUrl ?? this.src)
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

    const doc = await this.getDesignDocument()
    return doc
  }

  private reverseNodes(
    nodes: Record<string, any>[],
    map: Map<T, VGGNode>,
    parentPath: string
  ) {
    for (const [index, node] of nodes.entries()) {
      const currentPath = `${parentPath}/${index}`
      map.set(node.id, {
        path: currentPath,
      } as VGGNode)
      if (node.childObjects) {
        this.reverseNodes(node.childObjects, map, currentPath + "/childObjects")
      }
    }
  }

  public async getDesignDocument() {
    try {
      const docString = this.vggSdk?.getDesignDocument()
      if (!docString) {
        throw new Error("Failed to get design document")
      }
      const designDoc = JSON.parse(docString)
      const map = new Map<T, VGGNode>()
      this.reverseNodes(designDoc.frames, map, "/frames")
      this.VGGNodes = Object.fromEntries(map) as Record<T, VGGNode>

      return {
        nodes: this.VGGNodes,
      }
    } catch (err) {
      // console.log(err)
      return {
        nodes: {} as Record<T, VGGNode>,
      }
    }
  }

  public $(selector: T): Observable {
    if (!this.vggSdk) {
      throw new Error("VGG SDK not ready")
    }
    const path = this.VGGNodes[selector]?.path
    const isExist = this.observables.get(path)

    if (!isExist) {
      const newObservable = new Observable(path, this.vggSdk)
      this.observables.set(path, newObservable)
      return newObservable
    }

    return isExist
  }
}

class Observable {
  private selector: string
  private vggSdk: VggSdkType
  private eventManager: EventManager = new EventManager()

  constructor(selector: string, vggSdk: VggSdkType) {
    this.selector = selector
    this.vggSdk = vggSdk
  }

  public on(eventType: EventType, callback: EventCallback) {
    // console.log("on", eventType, callback)
    this.eventManager.add({
      type: eventType,
      callback: callback,
    })
    this.addEventListener(
      this.selector,
      eventType,
      `export default ${callback.toString()}`
    )
  }

  public next(eventType: EventType) {
    // console.log("next", eventType)
    this.eventManager.fire({
      type: eventType,
    })
  }

  private addEventListener(path: string, type: string, code: string) {
    if (!this.vggSdk) {
      throw new Error("VGG SDK not ready")
    }
    this.vggSdk.addEventListener(path, type, code)
  }
}
