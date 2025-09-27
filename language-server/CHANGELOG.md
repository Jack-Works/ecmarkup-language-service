# ecmarkup-language-server

## 0.4.0

### Minor Changes

- ac07899: Add findAllReference for variables
- ac07899: Drop the @@wellKnownSymbol in the output, switched to the new convention %Symbol.wellKnownSymbol%
- 127cb23: Support semantic tokens for User Code mark in biblio
- ac07899: Support reading local installed @tc39/ecma262-biblio
- ac07899: Improved the completion result, goto definition and semantic token result.
- ac07899: Add basic support of find all references

### Patch Changes

- 3a36f92: count p tag into alg header
- ac07899: Add basic support for local defined Abstract Operations

## 0.3.0

### Minor Changes

- 5926b57: add go-to definition support for variable and grammar
- 5926b57: add completion support for header parameters
- 5926b57: add hover support for local defined grammar
- 5926b57: add completion support for local defined grammar

## 0.2.0

### Minor Changes

- 009e5a7: remove format and diagnostics
- 009e5a7: migrate to ESM
- 3e50303: add hover
- 009e5a7: add completion

## 0.1.0

### Minor Changes

- 0b148c0: remove semanticToken provider
