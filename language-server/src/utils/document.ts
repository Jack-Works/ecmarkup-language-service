import { TextDocument, type TextDocumentContentChangeEvent } from 'vscode-languageserver-textdocument'

export class SourceFile {
    constructor(
        public readonly uri: string,
        public readonly languageId: string,
        public readonly text: TextDocument,
    ) {}

    static create(uri: string, languageId: string, version: number, content: string): SourceFile {
        return new SourceFile(uri, languageId, TextDocument.create(uri, languageId, version, content))
    }
    static update(document: SourceFile, changes: TextDocumentContentChangeEvent[], version: number): SourceFile {
        TextDocument.update(document.text, changes, version)
        return document
    }
}
