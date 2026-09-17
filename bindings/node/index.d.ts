import type Parser = require("tree-sitter");

declare const language: Parser.Language & {
  queries: {
    highlights: string;
    indents: string;
    folds: string;
    locals: string;
    tags: string;
  };
};

export = language;
