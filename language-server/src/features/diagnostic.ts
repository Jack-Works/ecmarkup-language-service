import { lint } from 'ecmarkup/lib/lint/lint.js'
import Spec, { walk } from 'ecmarkup/lib/Spec.js'
import ClauseNumbers from 'ecmarkup/lib/clauseNums.js'
import { JSDOM, VirtualConsole } from 'jsdom'
import {
    type CancellationToken,
    type Connection,
    type Diagnostic,
    type DiagnosticClientCapabilities,
    type DocumentDiagnosticParams,
    type DocumentDiagnosticReport,
    type PublishDiagnosticsClientCapabilities,
    Range,
    type ServerCapabilities,
    type TextDocumentChangeEvent,
    type WorkDoneProgressReporter,
} from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { documents } from '../server-shared.js'
import type { Program } from '../workspace/program.js'
import { typecheck } from 'ecmarkup/lib/typechecker.js'

export class Diagnostics {
    async diagnostic(
        document: TextDocument,
        program: Program,
        _params: DocumentDiagnosticParams | undefined,
        _token?: CancellationToken,
        _workDoneProgress?: WorkDoneProgressReporter,
    ): Promise<Diagnostic[]> {
        const source = document.getText()
        const biblio = await program.resolveBiblio(document.uri)

        const virtualConsole = new VirtualConsole()
        virtualConsole.on('error', () => {
            // Suppress warnings from e.g. CSS features not supported by JSDOM
        })
        const js_document = new JSDOM(source, { includeNodeLocations: true, virtualConsole })
        // biome-ignore lint/suspicious/noExplicitAny: cjs interop
        const spec: Spec = new ((Spec as any).default as typeof Spec)(
            document.uri,
            () => Promise.resolve(''),
            js_document,
            {
                extraBiblios: [
                    {
                        location: 'https://tc39.es/ecma262/',
                        // biome-ignore lint/suspicious/noExplicitAny: ...
                        entries: biblio as any,
                    },
                ],
                warn(error) {
                    const error_pos = { line: (error.line ?? 1) - 1, character: (error.column ?? 1) - 1 }
                    diagnostic.push({
                        message: error.message,
                        code: error.ruleId,
                        range: Range.create(error_pos, error_pos),
                    })
                },
            },
            source,
        )
        const diagnostic: Diagnostic[] = []
        await spec.loadBiblios()
        await lint(spec.warn, source, spec, js_document.window.document)
        const walker = js_document.window.document.createTreeWalker(
            js_document.window.document.body,
            1 | 4 /* elements and text nodes */,
        )
        await walk(walker, {
            spec: spec,
            node: js_document.window.document.body,
            importStack: [],
            clauseStack: [],
            tagStack: [],
            // biome-ignore lint/suspicious/noExplicitAny: cjs...
            clauseNumberer: (ClauseNumbers as any).default(spec),
            inNoAutolink: false,
            inAlg: false,
            inNoEmd: false,
            followingEmd: null,
            currentId: null,
        })

        spec.generateSDOMap()
        typecheck(spec)
        return diagnostic
    }

    static enable(
        serverCapabilities: ServerCapabilities<never>,
        connection: Connection,
        program: Program,
        push_capabilities: PublishDiagnosticsClientCapabilities | undefined,
        pull_capabilities: DiagnosticClientCapabilities | undefined,
    ) {
        const linter = new Diagnostics()
        const config = {
            enabled: false,
            enable(enable: boolean) {
                this.enabled = enable
                documents.all().forEach((document) => {
                    pushDiagnostics({ document })
                })
            },
        }

        const pushDiagnostics = (params: TextDocumentChangeEvent<TextDocument>) => {
            if (!config.enabled) {
                connection.sendDiagnostics({ uri: params.document.uri, diagnostics: [] })
                return
            }
            const document = params.document
            if (!document) return
            linter.diagnostic(document, program, undefined).then((diagnostic) => {
                connection.sendDiagnostics({ uri: document.uri, diagnostics: diagnostic })
            })
        }
        if (pull_capabilities) {
            connection.languages.diagnostics.on(
                async (params, token, workDoneProgress): Promise<DocumentDiagnosticReport> => {
                    if (!config.enabled) return { items: [], kind: 'full' }
                    const document = documents.get(params.textDocument.uri)
                    if (!document) return { items: [], kind: 'full' }
                    const diagnostic = await linter.diagnostic(document, program, params, token, workDoneProgress)
                    return { items: diagnostic, kind: 'full' }
                },
            )
            serverCapabilities.diagnosticProvider = {
                documentSelector: null,
                interFileDependencies: false,
                workspaceDiagnostics: false,
            }
        } else if (push_capabilities) {
            documents.onDidOpen(pushDiagnostics)
            documents.onDidChangeContent(pushDiagnostics)
        }
        return config
    }
}
