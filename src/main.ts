import "./style.css"
import { VGG, EventType } from "../lib/main"

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <h1>VGG Wasm</h1>
    <canvas id="canvas"></canvas>
  </div>
`

const vgg = new VGG({
  src: "https://s3.vgg.cool/test/vgg.daruma",
  runtime: "https://s3.vgg.cool/test/runtime/latest",
  editMode: true,
  verbose: true,
  canvas: document.querySelector("#canvas") as HTMLCanvasElement,
  onLoad: async (event) => {
    console.log("Loaded", event)
    await vgg.render()
    await vgg.getDesignDocument()
  },
  onLoadError: async (event) => {
    console.log("Load Error", event)
  },
  onStateChange: async (state) => {
    console.log("State Change", state)
  },
  onClick: async (element) => {
    console.log("OnClick", element)
  },
})

vgg.$("2:116").on("click", () => {
  window.alert("Hello, VGG!")
})
