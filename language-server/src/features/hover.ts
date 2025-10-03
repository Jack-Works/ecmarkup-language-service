import {
    type CancellationToken,
    type Connection,
    type Hover,
    type HoverClientCapabilities,
    type HoverParams,
    MarkupKind,
    type ServerCapabilities,
    type WorkDoneProgressReporter,
} from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { word_at_cursor } from '../parser/text.js'
import { documents } from '../server-shared.js'
import { getText } from '../utils/biblio.js'
import { formatDocument } from '../utils/format.js'
import type { Program } from '../workspace/program.js'

export class Hovers {
    constructor(public capabilities: HoverClientCapabilities | undefined) {}

    async hover(
        document: TextDocument,
        program: Program,
        params: HoverParams,
        _token?: CancellationToken,
        _workDoneProgress?: WorkDoneProgressReporter,
    ): Promise<Hover | undefined> {
        const source = document.getText()
        const offset = document.offsetAt(params.position)
        const sourceFile = program.getSourceFile(document)
        const biblio = await program.resolveBiblio(document.uri)

        const { word, isGrammar, isIntrinsic } = word_at_cursor(source, offset)

        const entry = biblio.find((entry) => {
            if (isGrammar) return entry.type === 'production' && word === entry.name
            else if (isIntrinsic) return entry.type === 'term' && word === entry.term.slice(1, -1)
            return word === getText(entry)
        })
        if (entry) {
            const contents = formatDocument(entry, this.capabilities?.contentFormat)
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

    static enable(
        features: ServerCapabilities<never>,
        connection: Connection,
        program: Program,
        capabilities: HoverClientCapabilities | undefined,
    ) {
        connection.onHover((params, token, workDoneProgress) => {
            const document = documents.get(params.textDocument.uri)
            if (!document) return null
            const hover = new Hovers(capabilities)
            return hover.hover(document, program, params, token, workDoneProgress)
        })
        features.hoverProvider = {}
    }
}
