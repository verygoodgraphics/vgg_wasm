import { resolve } from "path"
import { defineConfig } from "vite"
import dts from "vite-plugin-dts"

export default defineConfig({
  // optimizeDeps: {
  //   exclude: ["submodules/**"],
  // },
  // server: {
  //   fs: {
  //     deny: ["submodules/**"],
  //   },
  // },
  // esbuild: {
  //   exclude: ["submodules/**"],
  // },
  build: {
    lib: {
      entry: resolve(__dirname, "lib/main.ts"),
      name: "vgg-wasm",
      fileName: "vgg-wasm",
    },
  },
  plugins: [dts({ rollupTypes: true })],
})
