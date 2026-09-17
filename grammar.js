// Monkey C syntax, checked against Connect IQ SDK 9.1.0.
// Precedence is deliberately NOT C/Java precedence: shifts and bitwise AND
// share the multiplicative level, OR/XOR the additive level, and all
// comparisons share one level. Keep punctuation anonymous for CST consumers.
// Reference: SDK bin/monkeybrains.jar, MonkeyC2020.g4; no SDK is required to
// generate or load this parser. source_file is the root; src/node-types.json
// describes named nodes and fields. Comments are named extras, punctuation is
// retained, and whitespace is recovered from gaps in the original source.
// This is syntax, not Garmin's semantic/type/API checker. Empty statements and
// modifier placement are intentionally permissive for editor error recovery.
const PREC = { conditional: 1, cast: 7, unary: 8, member: 9 };
const KEYWORDS = [
  "class",
  "module",
  "extends",
  "as",
  "using",
  "import",
  "alias",
  "typedef",
  "interface",
  "Void",
  "Null",
  "public",
  "private",
  "protected",
  "hidden",
  "static",
  "const",
  "native",
  "var",
  "enum",
  "function",
  "while",
  "do",
  "for",
  "if",
  "else",
  "switch",
  "default",
  "case",
  "try",
  "catch",
  "finally",
  "throw",
  "break",
  "continue",
  "return",
  "true",
  "false",
  "null",
  "NaN",
  "new",
  "instanceof",
  "has",
  "and",
  "or",
  "self",
  "me",
];

module.exports = grammar({
  name: "monkeyc",
  extras: ($) => [/[ \t\r\n]+/, $.comment],
  word: ($) => $._identifier,
  reserved: { global: (_) => KEYWORDS },
  supertypes: ($) => [$._expression, $._type, $._statement],
  conflicts: ($) => [
    [$.block, $.dictionary_expression],
    [$._qualified_name, $.qualified_name],
    [$._qualified_name, $._primary],
    [$.qualified_name, $._primary],
    [$.dictionary_type_member, $._primary],
    [$._type, $.union_type],
    [$._type, $.nullable_type],
    [$._non_union_type, $.generic_type],
    [$.identifier, $.method_type],
    [$._primary, $._constructor],
    [$.array_expression, $.new_array_expression],
    [$.byte_array_expression, $.new_array_expression],
    [$._primary, $.signed_number],
    [$._additive, $._multiplicative_expression],
    [$._additive_expression, $._multiplicative_expression],
  ],

  rules: {
    source_file: ($) => repeat($._module_member),
    _module_member: ($) =>
      choice(
        $.module_declaration,
        $.class_declaration,
        $.function_declaration,
        $.variable_declaration,
        $.enum_declaration,
        $.typedef_declaration,
        $.using_declaration,
        $.import_declaration,
        $.alias_declaration,
        $.empty_statement,
      ),
    _class_member: ($) =>
      choice(
        $.class_declaration,
        $.function_declaration,
        $.variable_declaration,
        $.enum_declaration,
        $.typedef_declaration,
        $.using_declaration,
        $.import_declaration,
        $.alias_declaration,
        $.empty_statement,
      ),
    _decorators: ($) =>
      choice(seq($.annotations, repeat($.modifier)), repeat1($.modifier)),
    modifier: (_) =>
      choice("public", "private", "protected", "hidden", "static", "native"),
    annotations: ($) => seq("(", repeat(seq($.annotation, optional(","))), ")"),
    annotation: ($) =>
      seq(
        ":",
        field("name", $._symbol_name),
        optional(field("arguments", $.annotation_arguments)),
      ),
    annotation_arguments: ($) =>
      seq(
        "(",
        choice(
          $._symbol_name,
          $.string,
          $.character,
          $.number,
          $.signed_number,
          $.boolean,
          $.null,
          $.annotation_array,
        ),
        ")",
      ),
    annotation_array: ($) => seq("[", commaSep1($._symbol_name), "]"),
    _symbol_name: ($) =>
      prec(-1, choice($.identifier, alias(choice(...KEYWORDS), $.identifier))),

    module_declaration: ($) =>
      seq(
        optional($._decorators),
        "module",
        field("name", $.identifier),
        field("body", $.module_body),
      ),
    module_body: ($) => seq("{", repeat($._module_member), "}"),
    class_declaration: ($) =>
      seq(
        optional($._decorators),
        "class",
        field("name", $.identifier),
        optional(seq("extends", field("superclass", $._qualified_name))),
        field("body", $.class_body),
      ),
    class_body: ($) => seq("{", repeat($._class_member), "}"),
    using_declaration: ($) =>
      seq(
        "using",
        field("path", $._qualified_name),
        optional(seq("as", field("alias", $.identifier))),
        ";",
      ),
    import_declaration: ($) =>
      seq(
        "import",
        field("path", $._qualified_name),
        optional(seq(".", "*")),
        ";",
      ),
    alias_declaration: ($) =>
      seq(
        "alias",
        field("name", $.identifier),
        "as",
        field("alias", $.identifier),
        ";",
      ),
    _qualified_name: ($) => choice($.identifier, $.qualified_name),
    qualified_name: ($) =>
      seq(
        field(
          "scope",
          choice($.identifier, $.global, $.self, $.qualified_name),
        ),
        ".",
        field("name", $.identifier),
      ),
    function_declaration: ($) =>
      seq(
        optional($._decorators),
        "function",
        field("name", $.identifier),
        field("parameters", $.parameters),
        optional(field("return_type", $.return_type)),
        choice(field("body", $.block), ";"),
      ),
    parameters: ($) => seq("(", commaSep($.parameter), ")"),
    parameter: ($) =>
      seq(
        field("name", $.identifier),
        optional(field("type", $.type_annotation)),
      ),
    return_type: ($) => seq("as", choice($._type, $.void_type)),
    variable_declaration: ($) =>
      seq(
        optional($._decorators),
        field("kind", choice("var", "const")),
        commaSep1($.variable_declarator),
        ";",
      ),
    variable_declarator: ($) =>
      seq(
        field("name", $.identifier),
        optional(field("type", $.type_annotation)),
        optional(seq("=", field("value", $._expression))),
      ),
    enum_declaration: ($) =>
      seq(
        optional($._decorators),
        "enum",
        optional(field("name", $.identifier)),
        field("body", $.enum_body),
      ),
    enum_body: ($) => seq("{", commaSep1($.enum_member), optional(","), "}"),
    enum_member: ($) =>
      seq(
        optional($.annotations),
        field("name", $.identifier),
        optional(seq("=", field("value", $._expression))),
      ),
    typedef_declaration: ($) =>
      seq(
        optional($.annotations),
        "typedef",
        field("name", $.identifier),
        field("type", $.type_annotation),
        ";",
      ),

    type_annotation: ($) => seq("as", $._type),
    _type: ($) => choice($._non_union_type, $.union_type, $.nullable_type),
    _non_union_type: ($) =>
      choice(
        $.type_identifier,
        $.generic_type,
        $.dictionary_type,
        $.tuple_type,
        $.method_type,
        $.interface_type,
        $.null_type,
      ),
    type_identifier: ($) => $._qualified_name,
    null_type: (_) => "Null",
    void_type: (_) => "Void",
    union_type: ($) =>
      prec.dynamic(
        1,
        prec.right(
          seq(
            field("left", $._non_union_type),
            field("operator", choice("or", "|")),
            field("right", $._type),
          ),
        ),
      ),
    nullable_type: ($) => seq(field("type", $._non_union_type), "?"),
    generic_type: ($) =>
      prec.dynamic(
        1,
        seq(
          field("name", $.type_identifier),
          "<",
          field("key", $._type),
          optional(seq(",", field("value", $._type))),
          ">",
        ),
      ),
    tuple_type: ($) => seq("[", commaSep1($._type), optional(","), "]"),
    dictionary_type: ($) =>
      seq("{", commaSep1($.dictionary_type_member), optional(","), "}"),
    dictionary_type_member: ($) =>
      seq(
        field(
          "key",
          choice(
            $.symbol,
            $.number,
            $.signed_number,
            $.string,
            $.character,
            $.boolean,
          ),
        ),
        field("type", $.type_annotation),
      ),
    method_type: ($) =>
      prec.right(
        choice(
          seq(
            "Method",
            field("parameters", $.parameters),
            optional(field("return_type", $.return_type)),
          ),
          seq(
            "(",
            "Method",
            field("parameters", $.parameters),
            optional(field("return_type", $.return_type)),
            ")",
          ),
        ),
      ),
    interface_type: ($) =>
      seq(
        "interface",
        "{",
        repeat1(choice($.function_signature, $.interface_variable)),
        "}",
      ),
    function_signature: ($) =>
      seq(
        "function",
        field("name", $.identifier),
        field("parameters", $.parameters),
        optional(field("return_type", $.return_type)),
        repeat1(";"),
      ),
    interface_variable: ($) =>
      seq(
        "var",
        field("name", $.identifier),
        optional(field("type", $.type_annotation)),
        repeat1(";"),
      ),

    block: ($) => seq("{", repeat($._statement), "}"),
    _statement: ($) =>
      choice(
        $.block,
        $.local_variable_declaration,
        $.expression_statement,
        $.assignment_statement,
        $.update_statement,
        $.if_statement,
        $.while_statement,
        $.do_statement,
        $.for_statement,
        $.switch_statement,
        $.return_statement,
        $.break_statement,
        $.continue_statement,
        $.throw_statement,
        $.try_statement,
        $.empty_statement,
      ),
    local_variable_declaration: ($) =>
      seq("var", commaSep1($.variable_declarator), ";"),
    empty_statement: (_) => ";",
    expression_statement: ($) => seq($._expression, ";"),
    assignment_statement: ($) => seq($.assignment_expression, ";"),
    assignment_expression: ($) =>
      seq(
        field("left", $._assignable),
        field(
          "operator",
          choice(
            "=",
            "+=",
            "-=",
            "*=",
            "/=",
            "%=",
            "&=",
            "|=",
            "^=",
            "<<=",
            ">>=",
          ),
        ),
        field("right", $._expression),
      ),
    update_statement: ($) => seq($.update_expression, ";"),
    update_expression: ($) =>
      choice(
        seq(
          field("operator", choice("++", "--")),
          field("argument", $._assignable),
        ),
        seq(
          field("argument", $._assignable),
          field("operator", choice("++", "--")),
        ),
      ),
    _assignable: ($) =>
      choice(
        $.identifier,
        $.self,
        $.member_expression,
        $.index_expression,
        $.parenthesized_expression,
      ),
    if_statement: ($) =>
      seq(
        "if",
        field("condition", $.parenthesized_expression),
        field("consequence", $.block),
        optional(
          seq("else", field("alternative", choice($.block, $.if_statement))),
        ),
      ),
    while_statement: ($) =>
      seq(
        "while",
        field("condition", $.parenthesized_expression),
        field("body", $.block),
      ),
    do_statement: ($) =>
      seq(
        "do",
        field("body", $.block),
        "while",
        field("condition", $.parenthesized_expression),
        ";",
      ),
    for_statement: ($) =>
      seq(
        "for",
        "(",
        optional(
          field(
            "initializer",
            choice($.for_variable_declaration, $.expression_list),
          ),
        ),
        ";",
        optional(field("condition", $._expression)),
        ";",
        optional(field("update", $.expression_list)),
        ")",
        field("body", $.block),
      ),
    for_variable_declaration: ($) =>
      seq("var", commaSep1($.variable_declarator)),
    expression_list: ($) =>
      commaSep1(choice($.assignment_expression, $.update_expression)),
    switch_statement: ($) =>
      seq(
        "switch",
        field("value", $.parenthesized_expression),
        field("body", $.switch_body),
      ),
    switch_body: ($) =>
      seq("{", repeat1(choice($.switch_case, $.switch_default)), "}"),
    switch_case: ($) =>
      seq(
        "case",
        optional("instanceof"),
        field("value", $._expression),
        ":",
        repeat($._statement),
      ),
    switch_default: ($) => seq("default", ":", repeat($._statement)),
    return_statement: ($) =>
      seq("return", optional(field("value", $._expression)), ";"),
    break_statement: (_) => seq("break", ";"),
    continue_statement: (_) => seq("continue", ";"),
    throw_statement: ($) => seq("throw", field("value", $._expression), ";"),
    try_statement: ($) =>
      seq(
        "try",
        field("body", $.block),
        choice(
          seq(repeat1($.catch_clause), optional($.finally_clause)),
          $.finally_clause,
        ),
      ),
    catch_clause: ($) =>
      seq(
        "catch",
        "(",
        field("name", $.identifier),
        optional(seq("instanceof", field("type", $._qualified_name))),
        ")",
        field("body", $.block),
      ),
    finally_clause: ($) => seq("finally", field("body", $.block)),

    _expression: ($) => choice($._logical_or, $.conditional_expression),
    _logical_or: ($) =>
      choice($._logical_and, alias($._or_expression, $.binary_expression)),
    _logical_and: ($) =>
      choice($._comparison, alias($._and_expression, $.binary_expression)),
    _comparison: ($) =>
      choice($._additive, alias($._comparison_expression, $.binary_expression)),
    _additive: ($) =>
      choice(
        $._multiplicative,
        alias($._additive_expression, $.binary_expression),
      ),
    _multiplicative: ($) =>
      choice(
        $._factor,
        alias($._multiplicative_expression, $.binary_expression),
      ),
    _or_expression: ($) =>
      binary($._logical_or, choice("||", "or"), $._logical_and),
    _and_expression: ($) =>
      binary($._logical_and, choice("&&", "and"), $._comparison),
    _comparison_expression: ($) =>
      binary(
        $._comparison,
        choice("==", "!=", "<", "<=", ">", ">="),
        $._additive,
      ),
    _additive_expression: ($) =>
      binary($._additive, choice("+", "-", "|", "^"), $._multiplicative),
    _multiplicative_expression: ($) =>
      binary(
        $._multiplicative,
        choice(
          "*",
          "/",
          "%",
          "&",
          "<<",
          $.right_shift_operator,
          "instanceof",
          "has",
        ),
        $._factor,
      ),
    _factor: ($) => choice($._unary, $.cast_expression),
    _unary: ($) => choice($._primary, $.unary_expression),
    _primary: ($) =>
      choice(
        $.identifier,
        $.number,
        $.string,
        $.character,
        $.boolean,
        $.null,
        $.symbol,
        $.self,
        $.global,
        $.parenthesized_expression,
        $.array_expression,
        $.byte_array_expression,
        $.dictionary_expression,
        $.new_expression,
        $.new_array_expression,
        $.member_expression,
        $.index_expression,
        $.call_expression,
      ),
    parenthesized_expression: ($) => seq("(", $._expression, ")"),
    array_expression: ($) =>
      seq("[", optional(seq(commaSep1($._expression), optional(","))), "]"),
    byte_array_expression: ($) =>
      seq("[", optional(seq(commaSep1($._expression), optional(","))), "]b"),
    dictionary_expression: ($) =>
      seq("{", optional(seq(commaSep1($.pair), optional(","))), "}"),
    pair: ($) =>
      seq(field("key", $._expression), "=>", field("value", $._expression)),
    new_expression: ($) =>
      prec.dynamic(
        1,
        prec.right(
          PREC.member,
          seq(
            "new",
            field("type", $._constructor),
            field("arguments", $.arguments),
          ),
        ),
      ),
    _constructor: ($) =>
      choice(
        $.identifier,
        $.self,
        $.member_expression,
        $.index_expression,
        $.parenthesized_expression,
      ),
    new_array_expression: ($) =>
      seq(
        "new",
        optional(field("type", $._non_union_type)),
        "[",
        field("size", $._expression),
        choice("]", "]b"),
      ),
    member_expression: ($) =>
      prec.left(
        PREC.member,
        seq(field("object", $._primary), ".", field("property", $.identifier)),
      ),
    index_expression: ($) =>
      prec.left(
        PREC.member,
        seq(
          field("object", $._primary),
          "[",
          field("index", $._expression),
          "]",
        ),
      ),
    call_expression: ($) =>
      prec(
        PREC.member,
        seq(field("function", $._primary), field("arguments", $.arguments)),
      ),
    arguments: ($) => seq("(", commaSep($._expression), ")"),
    unary_expression: ($) =>
      prec.right(
        PREC.unary,
        seq(
          field("operator", choice("!", "~", "+", "-")),
          field("argument", $._unary),
        ),
      ),
    // The SDK lexes right shift as two tokens so nested generic closers work.
    right_shift_operator: (_) => seq(">", ">"),
    conditional_expression: ($) =>
      prec.right(
        PREC.conditional,
        seq(
          field("condition", $._logical_or),
          "?",
          field("consequence", $._expression),
          ":",
          field("alternative", $._expression),
        ),
      ),
    cast_expression: ($) =>
      prec.left(
        PREC.cast,
        seq(field("value", $._factor), "as", field("type", $._type)),
      ),

    _identifier: (_) => /[a-zA-Z_\u0080-\ufffe][a-zA-Z0-9_\u0080-\ufffe]*/,
    identifier: ($) => choice($._identifier, "Method"),
    self: (_) => choice("self", "me"),
    global: (_) => "$",
    symbol: ($) => seq(":", field("name", $._symbol_name)),
    boolean: (_) => choice("true", "false"),
    null: (_) => "null",
    signed_number: ($) => seq(field("operator", choice("+", "-")), $.number),
    // Invalid octal/hex digits are semantic diagnostics in the SDK, not syntax errors.
    number: ($) => choice($._number, "NaN"),
    _number: (_) =>
      token(
        choice(
          /0x[0-9a-zA-Z]+[lL]?/,
          /[0-9]+[lL]?/,
          /(?:0|[1-9][0-9]*)[fd]/,
          /(?:0|[1-9][0-9]*)(?:\.[0-9]+(?:[eE][+-]?[0-9]+)?|[eE][+-]?[0-9]+)[fd]?/,
          /\.[0-9]+(?:[eE][+-]?[0-9]+)?[fd]?/,
        ),
      ),
    string: ($) =>
      seq('"', repeat(choice($.string_content, $.escape_sequence)), '"'),
    string_content: (_) => token.immediate(/[^"\\]+/),
    character: ($) =>
      seq(
        "'",
        choice(
          alias(token.immediate(/[^'\\]/), $.character_content),
          $.escape_sequence,
        ),
        "'",
      ),
    escape_sequence: (_) =>
      token.immediate(/\\(?:[nrtbf"'\\]|u[0-9a-fA-F]{4})/),
    comment: (_) =>
      token(choice(/\/\/[^\r\n]*/, /\/\*[^*]*\*+([^/*][^*]*\*+)*\//)),
  },
});

function commaSep(rule) {
  return optional(commaSep1(rule));
}
function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}
function binary(left, operator, right) {
  return seq(
    field("left", left),
    field("operator", operator),
    field("right", right),
  );
}
