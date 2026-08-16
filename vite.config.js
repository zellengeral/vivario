import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Publicado em zellen.pt/vivaro (subpasta) — ajuste ou remova esta linha
  // se um dia mudar para a raiz do domínio ou para um subdomínio.
  base: "/vivaro/",
  plugins: [react()],
});
