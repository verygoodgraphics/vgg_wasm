import { resolve } from "path"
import { defineConfig } from "vite"
import dts from "vite-plugin-dts"

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "lib/main.ts"),
      name: "vgg-core",
      fileName: "vgg-core",
    },
  },
  plugins: [dts({ rollupTypes: true })],
})
