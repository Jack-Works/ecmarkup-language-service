import {
    type CancellationToken,
    type Connection,
    type DocumentFormattingClientCapabilities,
    type DocumentFormattingParams,
    type DocumentOnTypeFormattingParams,
    type DocumentRangeFormattingParams,
    type HandlerResult,
    type ServerCapabilities,
    type TextDocuments,
    TextEdit,
    type WorkDoneProgressReporter,
} from 'vscode-languageserver'
import type { TextDocument } from '../lib.js'

import formatter = require('ecmarkup/lib/formatter/ecmarkup.js')

export function formatProvider(
    connection: Connection,
    documents: TextDocuments<TextDocument>,
    capabilities: DocumentFormattingClientCapabilities | undefined,
): NonNullable<ServerCapabilities['documentFormattingProvider']> {
    const hover = new Formatter(capabilities)
    connection.onDocumentFormatting(hover.handler(documents))
    // connection.onDocumentRangeFormatting(hover.handlerRange(documents))
    // connection.onDocumentOnTypeFormatting(hover.handlerOnType(documents))
    return {}
}

export class Formatter {
    constructor(public capabilities: DocumentFormattingClientCapabilities | undefined) {}

    async format(document: TextDocument, _params: DocumentFormattingParams): Promise<TextEdit[] | undefined> {
        const formatted = await formatter.printDocument(document.getText())
        return [
            TextEdit.replace(
                { start: document.positionAt(0), end: document.positionAt(document.getText().length) },
                formatted,
            ),
        ]
    }

    async formatRange(_document: TextDocument, _params: DocumentRangeFormattingParams): Promise<TextEdit[] | undefined> {
        return undefined
    }

    async formatOnType(_document: TextDocument, _params: DocumentOnTypeFormattingParams): Promise<TextEdit[] | undefined> {
        return undefined
    }

    handler(documents: TextDocuments<TextDocument>) {
        return (params: DocumentFormattingParams): HandlerResult<TextEdit[] | undefined | null, void> => {
            const document = documents.get(params.textDocument.uri)
            if (!document) return null
            return this.format(document, params)
        }
    }

    handlerRange(documents: TextDocuments<TextDocument>) {
        return (
            params: DocumentRangeFormattingParams,
            _token?: CancellationToken,
            _workDoneProgress?: WorkDoneProgressReporter,
        ): HandlerResult<TextEdit[] | undefined | null, void> => {
            const document = documents.get(params.textDocument.uri)
            if (!document) return null
            return this.formatRange(document, params)
        }
    }

    handlerOnType(documents: TextDocuments<TextDocument>) {
        return (params: DocumentOnTypeFormattingParams): HandlerResult<TextEdit[] | undefined | null, void> => {
            const document = documents.get(params.textDocument.uri)
            if (!document) return null
            return this.formatOnType(document, params)
        }
    }
}
