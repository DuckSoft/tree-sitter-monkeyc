# tree-sitter-monkeyc

A [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for Garmin Monkey C (`.mc`) source files.

This project provides an incremental syntax parser and editor queries. It is not a Monkey C compiler and does not perform Connect IQ semantic, type, or API validation.

Both bindings compile native code and require a C/C++ compiler toolchain. The Rust binding requires Rust and Cargo; the Node.js binding requires Node.js, npm, and Python for `node-gyp`.

## Rust

Add the grammar and compatible Tree-sitter runtime from crates.io:

```toml
[dependencies]
tree-sitter = "0.25"
tree-sitter-monkeyc = "0.1.1"
```

Load the language with the exported `LANGUAGE` constant:

```rust
use tree_sitter::Parser;

fn main() {
    let mut parser = Parser::new();
    parser
        .set_language(&tree_sitter_monkeyc::LANGUAGE.into())
        .expect("failed to load the Monkey C grammar");

    let tree = parser
        .parse("function answer() as Number { return 42; }", None)
        .expect("parser returned no tree");

    println!("{}", tree.root_node().to_sexp());
}
```

The Rust binding also exports `NODE_TYPES` and the query constants `HIGHLIGHTS_QUERY`, `INDENTS_QUERY`, `FOLDS_QUERY`, `LOCALS_QUERY`, and `TAGS_QUERY`.

## Node.js

Install the package from its repository together with the compatible Tree-sitter runtime:

```sh
npm install tree-sitter@^0.25 github:DuckSoft/tree-sitter-monkeyc
```

```js
const Parser = require("tree-sitter");
const MonkeyC = require("tree-sitter-monkeyc");

const parser = new Parser();
parser.setLanguage(MonkeyC);

const tree = parser.parse("var greeting = \"hello\";");
console.log(tree.rootNode.toString());
```

The Node binding exposes generated node metadata as `MonkeyC.nodeTypeInfo` and query source strings under `MonkeyC.queries`.

## Queries

The `queries/` directory contains queries for:

- syntax highlighting (`highlights.scm`)
- indentation (`indents.scm`)
- code folding (`folds.scm`)
- local variables (`locals.scm`)
- symbol tags (`tags.scm`)

Zed-specific bracket and outline queries are in `queries/zed/`.

## Development

Node.js 22 is used in CI. Install dependencies and regenerate the checked-in parser after changing `grammar.js`:

```sh
npm ci
npm run generate
```

Run the corpus and binding checks used by CI:

```sh
npm test
cargo test
```

`npm test` runs the Tree-sitter corpus, rebuilds the native Node binding, and runs its Node test suite. To parse-check one or more directories or files containing Monkey C source:

```sh
npm run check:sources -- path/to/project
```

To include samples from the installed Connect IQ SDK, use `--sdk`. The script discovers the SDK through `SDK_HOME` or Garmin's `current-sdk.cfg`:

```sh
npm run check:sources -- --sdk
```

## License

Released into the public domain under [The Unlicense](LICENSE).
