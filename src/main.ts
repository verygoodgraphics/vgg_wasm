import "./style.css"
// import '../dist/index.d.ts'
// import { VGG, EventType } from "../dist/vgg-wasm.js"
import { VGG, EventType } from "../lib/main"
import { State } from "../lib/constants"
import { Generated_Nodes_Type } from "./main.d"

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <h1>VGG Wasm</h1>
    <canvas id="canvas"></canvas>
  </div>
`

const vgg = new VGG<Generated_Nodes_Type>({
  src: "https://s3.vgg.cool/test/vgg.daruma",
  runtime: "https://s3.vgg.cool/test/runtime/latest",
  // editMode: true,
  verbose: true,
  canvas: document.querySelector("#canvas") as HTMLCanvasElement,
  // onLoad: async (event) => console.log("Load", event),
  // onLoadError: async (event) => console.log("Load Error", event),
  // onStateChange: async (state) => console.log("State Change", state),
})

await vgg.load()

if (vgg.state === State.Ready) {
  await vgg.render()

  // {
  // const { nodes } = await vgg.render()
  // const keys = Object.keys(nodes)
  //   .map((i) => `"${i}"`)
  //   .join(" | ")
  // console.log(keys)
  // }

  vgg.$("2:94").on(EventType.Click, async () => {
    window.alert("Hello, VGG!")
  })
}
