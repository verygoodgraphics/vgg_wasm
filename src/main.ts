import "./style.css"
import { VGG, EventType } from "../lib/main"

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <h1>VGG Wasm</h1>
    <canvas id="canvas"></canvas>
  </div>
`

const vgg = new VGG({
  src: "https://s5.vgg.cool/examples/latest/vgg.daruma",
  // editMode: true,
  canvas: document.querySelector("#canvas") as HTMLCanvasElement,
  onLoad: (event) => {
    console.log("Loaded", event)
    vgg.render()
    vgg.getDesignDocument()
  },
  onLoadError: (event) => {
    console.log("Load Error", event)
  },
  onStateChange: (state) => {
    console.log("State Change", state)
  },
})

// vgg.on(EventType.Load, () => {
//   console.log("Loaded")
//   // vgg.run()
// })
