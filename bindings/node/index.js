// Native tree-sitter 0.25 language: new Parser().setLanguage(require("tree-sitter-monkeyc")).
// Query strings are exported below; Zed's outline/brackets queries are shipped
// separately in queries/zed. Regenerate src/ with `npm run generate`, then use
// `npm run build` to rebuild the native binding after grammar changes.
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "..");
const binding = require("node-gyp-build")(root);

binding.nodeTypeInfo = require("../../src/node-types.json");

binding.queries = Object.fromEntries(
  ["highlights", "indents", "folds", "locals", "tags"].map((name) => [
    name,
    fs.readFileSync(path.join(root, "queries", `${name}.scm`), "utf8"),
  ]),
);

module.exports = binding;
