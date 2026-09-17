//! Monkey C language support for the tree-sitter parsing library.
//!
//! Uses tree-sitter ABI 15 (runtime 0.25 or newer). Pass `LANGUAGE.into()` to
//! `tree_sitter::Parser::set_language`. `NODE_TYPES` describes CST fields for
//! formatter consumers: comments and punctuation are retained, while whitespace
//! must be preserved or regenerated from the original source's byte gaps.
//! Standard queries are exported here; Zed outline/bracket queries are shipped
//! under `queries/zed/`. This crate does not perform Connect IQ semantic checks.

use tree_sitter_language::LanguageFn;

extern "C" {
    fn tree_sitter_monkeyc() -> *const ();
}

/// The tree-sitter language function for this grammar.
pub const LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_monkeyc) };

/// The generated node type metadata.
pub const NODE_TYPES: &str = include_str!("../../src/node-types.json");

/// The syntax highlighting query.
pub const HIGHLIGHTS_QUERY: &str = include_str!("../../queries/highlights.scm");

/// The indentation query.
pub const INDENTS_QUERY: &str = include_str!("../../queries/indents.scm");

/// The code folding query.
pub const FOLDS_QUERY: &str = include_str!("../../queries/folds.scm");

/// The local-variable query.
pub const LOCALS_QUERY: &str = include_str!("../../queries/locals.scm");

/// The symbol tagging query.
pub const TAGS_QUERY: &str = include_str!("../../queries/tags.scm");

#[cfg(test)]
mod tests {
    #[test]
    fn parses_typed_function() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("Error loading Monkey C parser");
        let tree = parser
            .parse("function read() as Array<Number> { return [1]; }", None)
            .expect("Expected a syntax tree");
        let root = tree.root_node();
        assert!(!root.has_error());
        let function = root.named_child(0).unwrap();
        assert_eq!(function.kind(), "function_declaration");
        assert_eq!(
            function
                .child_by_field_name("return_type")
                .unwrap()
                .named_child(0)
                .unwrap()
                .kind(),
            "generic_type"
        );
    }

    #[test]
    fn queries_compile() {
        let language = super::LANGUAGE.into();
        for (name, source) in [
            ("highlights", super::HIGHLIGHTS_QUERY),
            ("indents", super::INDENTS_QUERY),
            ("folds", super::FOLDS_QUERY),
            ("locals", super::LOCALS_QUERY),
            ("tags", super::TAGS_QUERY),
        ] {
            tree_sitter::Query::new(&language, source)
                .unwrap_or_else(|error| panic!("{name} query failed to compile: {error}"));
        }
    }
}
