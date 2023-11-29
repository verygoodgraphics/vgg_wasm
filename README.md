# VGG WASM

## Usage

```js
import { VGG } from "@verygoodgraphics/vgg-wasm"

const vgg = await new VGG({
  src: "https://s5.vgg.cool/vgg.daruma",
  canvas: document.querySelector("#canvas") as HTMLCanvasElement,
}).load()

if (vgg.state === State.Ready)
  await vgg.render()
```

## API

### Options

| Option        | Type                                     | Required | Default                            |
| ------------- | ---------------------------------------- | -------- | ---------------------------------- |
| canvas        | `HTMLCanvasElement` \| `OffscreenCanvas` | ✅       | -                                  |
| runtime       | `string`                                 | -        | https://s5.vgg.cool/runtime/latest |
| editMode      | `boolean`                                | -        | false                              |
| verbose       | `boolean`                                | -        | false                              |
| onLoad        | `EventCallback`                          | -        | -                                  |
| onLoadError   | `EventCallback`                          | -        | -                                  |
| onStateChange | `EventCallback`                          | -        | -                                  |

### `.load()`

After loading, the state will be `State.Ready` or `State.Error`.

### `.render()`

When the state is `State.Ready`, we can call this method to render the canvas.

### `$(selector: string)`

Get the element by selector.

## FAQ

1. How to get the element selector?\
   set `editMode` and `verbose` to `true`, then you can see the selector in the console when select specific element in the canvas.
