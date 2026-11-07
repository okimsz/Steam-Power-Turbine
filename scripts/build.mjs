import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (name) => readFile(path.join(root, name), "utf8");

// Minimal bundler for this project's named relative imports and named exports.
// Keep modules in src/. For a more complex import graph, use a full bundler.
const seen = new Set();
async function bundle(relative) {
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(path.join(root, "src") + path.sep)) {
    throw new Error(`Only src/ modules can be bundled: ${relative}`);
  }
  if (seen.has(absolute)) return "";
  seen.add(absolute);
  let source = await readFile(absolute, "utf8");
  const dependencies = [];
  const imports = /^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?\s*$/gm;
  for (const match of source.matchAll(imports)) {
    if (/\bas\b/.test(match[1]) || !match[2].startsWith("./")) {
      throw new Error(
        "This small bundler supports unaliased, relative named imports only.",
      );
    }
    dependencies.push(
      await bundle(
        path.relative(root, path.resolve(path.dirname(absolute), match[2])),
      ),
    );
  }
  source = source
    .replace(imports, "")
    .replace(/^export\s*\{[^}]*\};?\s*$/gm, "")
    .replace(/^export\s+(?=(function|const|let|class)\b)/gm, "");
  if (/^\s*(import|export)\b/m.test(source))
    throw new Error(`Unsupported module syntax in ${relative}`);
  return [...dependencies, `// ${relative}\n${source}`].join("\n");
}

const library = await read("vendor/three.min.js");
const license = await read("vendor/three-LICENSE.txt");
const css = await read("src/styles.css");
const app = await bundle("src/app.js");
const errors = await read("src/errors.js");
const escapeScript = (text) => text.replace(/<\/script/gi, "<\\/script");
let html = await read("index.html");
html = html
  .replace(
    /<link rel="stylesheet" href="src\/styles.css"\s*\/?>/,
    () => `<style>\n${css}\n</style>`,
  )
  .replace(
    /<script src="src\/errors.js">\s*<\/script>/,
    () => `<script>${escapeScript(errors)}</script>`,
  )
  .replace(
    /<script src="vendor\/three.min.js">\s*<\/script>/,
    () => `<script>/*\n${license}\n*/\n${escapeScript(library)}</script>`,
  )
  .replace(
    /<script type="module" src="src\/app.js">\s*<\/script>/,
    () =>
      `<script>\n'use strict';\n(()=>{\n${escapeScript(app)}\n})();\n</script>`,
  );
if (/<script[^>]+src=|<link[^>]+rel="stylesheet"/.test(html))
  throw new Error("Unbundled runtime asset");
await mkdir(path.join(root, "dist"), { recursive: true });
await writeFile(path.join(root, "dist/steam-turbine-simulator.html"), html);
console.log(
  `Built dist/steam-turbine-simulator.html (${Buffer.byteLength(html).toLocaleString()} bytes). Open it directly in a browser.`,
);
