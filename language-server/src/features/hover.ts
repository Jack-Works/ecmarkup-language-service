import {
    type CancellationToken,
    type Connection,
    type HandlerResult,
    type Hover,
    type HoverParams,
    MarkupKind,
    type ServerCapabilities,
    type TextDocuments,
    type WorkDoneProgressReporter,
} from 'vscode-languageserver'
import type { TextDocument } from '../lib.js'
import { getText } from '../utils/biblio.js'
import { formatDocument } from '../utils/format.js'
import { word_at_cursor } from '../utils/text.js'
import type { Program } from '../workspace/program.js'

export function hoverProvider(
    connection: Connection,
    program: Program,
    documents: TextDocuments<TextDocument>,
): NonNullable<ServerCapabilities['hoverProvider']> {
    const hover = new HoverProvider()
    connection.onHover(hover.handler(documents, program))
    return {}
}

export class HoverProvider {
    async hover(
        document: TextDocument,
        program: Program,
        params: HoverParams,
        _token?: CancellationToken,
        _workDoneProgress?: WorkDoneProgressReporter,
    ): Promise<Hover | undefined> {
        const fullText = document.getText()
        const offset = document.offsetAt(params.position)
        const sourceFile = program.getSourceFile(document)
        const biblio = await program.resolveBiblio(document.uri)

        const { word, isGrammar, isIntrinsic } = word_at_cursor(fullText, offset)

        const entry = biblio.find((entry) => {
            if (isGrammar) return entry.type === 'production' && word === entry.name
            else if (isIntrinsic) return entry.type === 'term' && word === entry.term.slice(1, -1)
            return word === getText(entry)
        })
        if (entry) {
            const contents = formatDocument(entry)
            if (!contents) return undefined
            return { contents }
        }

        {
            const local = sourceFile.localDefinedGrammars.filter((define) => define.name === word)
            if (local[0]) {
                return { contents: { kind: MarkupKind.PlainText, language: 'grammarkdown', value: local[0].summary } }
            }
        }
        {
            const local = sourceFile.localDefinedAbstractOperations.filter((define) => define.name === word)
            if (local[0]) {
                return { contents: { kind: MarkupKind.PlainText, language: 'ecmarkup', value: local[0].summary } }
            }
        }
        return undefined
    }

    handler(documents: TextDocuments<TextDocument>, program: Program) {
        return (
            params: HoverParams,
            _token?: CancellationToken,
            _workDoneProgress?: WorkDoneProgressReporter,
        ): HandlerResult<Hover | null | undefined, void> => {
            const document = documents.get(params.textDocument.uri)
            if (!document) return null
            return this.hover(document, program, params, _token, _workDoneProgress)
        }
    }
}
