(module_declaration name: (identifier) @name) @definition.module
(class_declaration name: (identifier) @name) @definition.class
(function_declaration name: (identifier) @name) @definition.function
(typedef_declaration name: (identifier) @name) @definition.type
(enum_declaration name: (identifier) @name) @definition.type
(call_expression function: (identifier) @name) @reference.call
(call_expression function: (member_expression property: (identifier) @name)) @reference.call
