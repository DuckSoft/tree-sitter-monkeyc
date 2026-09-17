const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Parser = require("tree-sitter");
const language = require("./index");

function parser() {
  return new Parser().setLanguage(language);
}

function parse(source) {
  const tree = parser().parse(source);
  assert.equal(tree.rootNode.hasError, false, tree.rootNode.toString());
  return tree;
}

function value(expression) {
  return parse(
    `var result = ${expression};`,
  ).rootNode.firstNamedChild.firstNamedChild.childForFieldName("value");
}

function shape(node) {
  if (node.type === "binary_expression") {
    return [
      node.childForFieldName("operator").text,
      shape(node.childForFieldName("left")),
      shape(node.childForFieldName("right")),
    ];
  }
  return node.text;
}

test("operators use Monkey C precedence rather than C precedence", () => {
  for (const [expression, expected] of [
    ["a + b << c", ["+", "a", ["<<", "b", "c"]]],
    ["a & b * c", ["*", ["&", "a", "b"], "c"]],
    ["a | b + c", ["+", ["|", "a", "b"], "c"]],
    ["a == b < c", ["<", ["==", "a", "b"], "c"]],
    ["a + b instanceof C", ["+", "a", ["instanceof", "b", "C"]]],
    ["a has :run and b or c", ["or", ["and", ["has", "a", ":run"], "b"], "c"]],
    ["a + b >> c", ["+", "a", [">>", "b", "c"]]],
    ["a - b - c", ["-", ["-", "a", "b"], "c"]],
  ]) {
    assert.deepEqual(shape(value(expression)), expected, expression);
  }
  assert.equal(
    value("a ? b : c ? d : e").childForFieldName("alternative").type,
    "conditional_expression",
  );
});

test("casts distinguish nullable and generic types from following operators", () => {
  assert.equal(
    value("a as Number < limit").childForFieldName("left").type,
    "cast_expression",
  );
  assert.equal(
    value("a as Number ? yes : no").childForFieldName("condition").type,
    "cast_expression",
  );
  assert.equal(value("a as Number or null").type, "binary_expression");
  assert.equal(
    value("a as Number or String").childForFieldName("type").type,
    "union_type",
  );
  const type = value("a as Array<Array<Number>>").childForFieldName("type");
  assert.equal(type.childForFieldName("key").type, "generic_type");
  assert.equal(
    value("-a as Number").childForFieldName("value").type,
    "unary_expression",
  );
});

test("constructor targets do not become typed array allocations", () => {
  const constructed = value("new owners[0].Finder()");
  assert.equal(constructed.type, "new_expression");
  assert.equal(
    constructed.childForFieldName("type").childForFieldName("object").type,
    "index_expression",
  );
  assert.equal(value("new Array<Number>[4]").type, "new_array_expression");
});

test("Method can name a value, a concrete type or a callback signature", () => {
  const tree = parse(
    "function Method(Method as Method) as Method { return Method; }\n" +
      "typedef Callback as Method(x as Number) as String or Null;\n" +
      "typedef Optional as (Method(x as Number) as String) or Null;",
  );
  const declarations = tree.rootNode.namedChildren;
  assert.equal(declarations[0].childForFieldName("name").text, "Method");
  const callback = declarations[1].childForFieldName("type").firstNamedChild;
  assert.equal(callback.type, "method_type");
  assert.equal(
    callback.childForFieldName("return_type").firstNamedChild.type,
    "union_type",
  );
  assert.equal(
    declarations[2].childForFieldName("type").firstNamedChild.type,
    "union_type",
  );
});

test("malformed syntax is reported and subsequent declarations recover", () => {
  for (const source of [
    "var if = 1;", // Reserved word, not an identifier.
    "var x = [,];", // Missing array element.
    "var x = {,};", // Missing dictionary pair.
    "var x = '\\q';", // Unsupported escape.
    "var x = 1", // Missing semicolon.
    "function f() { if (x) return; }", // Control bodies require braces.
    "function f() { 1 = x; }", // Not an assignment target.
    "function f() { x = y = 1; }", // Assignment is not a value expression.
  ]) {
    assert.equal(parser().parse(source).rootNode.hasError, true, source);
  }
  const tree = parser().parse(
    "function broken() { var = ; }\nfunction intact() { return 1; }",
  );
  assert.equal(tree.rootNode.hasError, true);
  const intact = tree.rootNode.namedChildren.find(
    (node) =>
      node.type === "function_declaration" &&
      node.childForFieldName("name").text === "intact",
  );
  assert.equal(intact.childForFieldName("body").hasError, false);
});

test("incremental edits produce the same tree and ranges as a fresh parse", () => {
  const p = parser();
  const before = "function f() { return enabled ? [1]b : [2]b; }";
  const oldTree = p.parse(before);
  const start = before.indexOf("enabled");
  const replacement = "modes[index]";
  const after = before.slice(0, start) + replacement + before.slice(start + 7);
  oldTree.edit({
    startIndex: start,
    oldEndIndex: start + 7,
    newEndIndex: start + replacement.length,
    startPosition: { row: 0, column: start },
    oldEndPosition: { row: 0, column: start + 7 },
    newEndPosition: { row: 0, column: start + replacement.length },
  });
  const incremental = p.parse(after, oldTree);
  const fresh = p.parse(after);
  assert.equal(incremental.rootNode.hasError, false);
  function snapshot(node) {
    return [
      node.type,
      node.startIndex,
      node.endIndex,
      node.children.map(snapshot),
    ];
  }
  assert.deepEqual(snapshot(incremental.rootNode), snapshot(fresh.rootNode));
  assert.equal(
    incremental.rootNode.descendantsOfType("index_expression")[0].text,
    replacement,
  );
});

test("formatter consumers retain comments, delimiters and source spans", () => {
  const source =
    "//! 文档\nvar x = { :ready /* key */ => [1, 2,]b, }; // end\n";
  const tree = parse(source);
  assert.deepEqual(
    tree.rootNode.descendantsOfType("comment").map((n) => n.text),
    ["//! 文档", "/* key */", "// end"],
  );
  const leaves = [];
  function visit(node) {
    if (!node.childCount) leaves.push(node);
    else node.children.forEach(visit);
  }
  visit(tree.rootNode);
  for (const punctuation of ["{", "}", ":", "=>", "[", "]b", ",", ";"]) {
    assert.ok(
      leaves.some((n) => n.text === punctuation),
      punctuation,
    );
  }
  let offset = 0;
  let reconstructed = "";
  for (const leaf of leaves) {
    const gap = source.slice(offset, leaf.startIndex);
    assert.match(gap, /^\s*$/);
    reconstructed += gap + leaf.text;
    offset = leaf.endIndex;
  }
  reconstructed += source.slice(offset);
  assert.equal(reconstructed, source);
});

test("editor queries compile and capture symbols, locals and highlighting", () => {
  const source =
    "(:test) class Finder { function find(x as Number) { var result = x; return self.run(:ready); } }";
  const tree = parse(source);
  const queries = Object.fromEntries(
    Object.entries(language.queries).map(([name, text]) => [
      name,
      new Parser.Query(language, text),
    ]),
  );
  function captured(query, capture) {
    return query
      .captures(tree.rootNode)
      .filter((c) => c.name === capture)
      .map((c) => c.node.text);
  }
  assert.ok(captured(queries.highlights, "attribute").includes("test"));
  assert.ok(captured(queries.highlights, "function").includes("find"));
  assert.ok(
    captured(queries.highlights, "string.special.symbol").includes(":ready"),
  );
  assert.deepEqual(captured(queries.locals, "local.definition"), [
    "x",
    "result",
  ]);
  assert.deepEqual(captured(queries.tags, "name"), ["Finder", "find", "run"]);
  const outline = new Parser.Query(
    language,
    fs.readFileSync(
      path.join(__dirname, "../../queries/zed/outline.scm"),
      "utf8",
    ),
  );
  assert.deepEqual(captured(outline, "name"), ["Finder", "find"]);
  const brackets = new Parser.Query(
    language,
    fs.readFileSync(
      path.join(__dirname, "../../queries/zed/brackets.scm"),
      "utf8",
    ),
  );
  const pairs = brackets.matches(
    parse("var x as Array<Number> = [1]b;").rootNode,
  );
  assert.deepEqual(
    pairs.map((m) => m.captures.map((c) => c.node.text)),
    [
      ["<", ">"],
      ["[", "]b"],
    ],
  );
});
