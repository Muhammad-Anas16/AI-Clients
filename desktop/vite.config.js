// import { defineConfig } from "vite";
// import react from "@vitejs/plugin-react";
// import process from "node:process";
// import tailwindcss from "@tailwindcss/vite";
// const host = process.env.TAURI_DEV_HOST;

// // https://vite.dev/config/
// export default defineConfig(() => ({
//   plugins: [react(), tailwindcss()],

//   clearScreen: false,
//   server: {
//     port: 1420,
//     strictPort: true,
//     host: host || "127.0.0.1",
//     hmr: host
//       ? {
//           protocol: "ws",
//           host,
//           port: 1421,
//         }
//       : undefined,
//     watch: {
//       // 3. tell Vite to ignore watching `src-tauri`
//       ignored: ["**/src-tauri/**"],
//     },
//   },
// }));

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import process from "node:process";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],

  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,

    // Allow LAN + localhost
    host: host || "0.0.0.0",

    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,

    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
