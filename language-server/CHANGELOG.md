# ecmarkup-language-server

## 0.6.0

### Minor Changes

- 07fa995: Add diagnostics and a settings to disable it

## 0.5.0

### Minor Changes

- 33220a3: Add document symbols
- c4adc8c: Add rename
- 81af9c4: Add format, range format and format on type

### Patch Changes

- d5c7a21: Add plainText support for completion and hover
- 86abde1: Fix AO snippet conflicts with aoid completion
- f261968: Add document highlight (use same result from find references)
- f261968: Fix some false positive of find reference
- b99b105: Add local defined AO to semantic token
- 3475d95: Add LocationLink support to goto definition

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
