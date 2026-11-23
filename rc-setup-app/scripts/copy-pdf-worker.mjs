// Copies the pdf.js worker into /public so the browser-side PDF importer can load it.
import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("public", { recursive: true });
copyFileSync("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/pdf.worker.min.mjs");
console.log("Copied pdf.worker.min.mjs to public/");
