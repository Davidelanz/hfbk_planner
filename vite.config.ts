import { defineConfig } from "vite";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const localData = () => ({
  name: "local-private-data",
  configureServer(server) {
    server.middlewares.use("/data.json", async (_request, response) => {
      try {
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.end(await readFile(resolve(process.cwd(), "data/data.json")));
      } catch {
        response.statusCode = 404;
        response.end();
      }
    });
  },
});

export default defineConfig({
  root: "src",
  base: "./",
  plugins: [localData()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    minify: true,
    target: "es2022",
  },
});
