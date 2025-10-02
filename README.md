# ecmarkup language service

## VSCode

The [VSCode extension](https://marketplace.visualstudio.com/items?itemName=magicworks.ecmarkup) provides rich language support for the [ecmarkup language](https://github.com/tc39/ecmarkup).

## Roadmap

- [Select range](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_selectionRange) support (for nested calls in emu-alg like Get(Call(...)))
- [Inlay hint](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_inlayHint) for AO parameters
- [Code Action](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_codeAction) for ...
  - Rename @@ notation to %Symbol.% notation

### Hard, that require bundle ecmarkup compiler

- [Formatter](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_formatting)

<!-- Currently this library does not do real analysis because the compiler of the [ecmarkup language](https://github.com/tc39/ecmarkup) and the [grammarkdown language](https://github.com/rbuckton/grammarkdown) do not designed for IDE cases. -->

<!-- I cannot do too much things before we have real analysis https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#languageFeatures -->
