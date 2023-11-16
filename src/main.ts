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
  canvas: document.querySelector("#canvas") as HTMLCanvasElement,
})

vgg.on(EventType.Load, () => {
  console.log("Loaded")
  vgg.run()
})

// async function init() {
//   console.log(window._vgg_createWasmInstance)
// }

// init()
