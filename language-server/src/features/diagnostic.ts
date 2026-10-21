import ClauseNumbers from 'ecmarkup/lib/clauseNums.js'
import { lint } from 'ecmarkup/lib/lint/lint.js'
import * as SpecModule from 'ecmarkup/lib/Spec.js'
import { walk } from 'ecmarkup/lib/Spec.js'
import { typecheck } from 'ecmarkup/lib/typechecker.js'
import { JSDOM, VirtualConsole } from 'jsdom'
import {
    type CancellationToken,
    type Connection,
    type Diagnostic,
    type DiagnosticClientCapabilities,
    DiagnosticRefreshRequest,
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
        const Spec = ((SpecModule as any).default?.default ?? (SpecModule as any).default) as any
        // biome-ignore lint/suspicious/noExplicitAny: cjs interop
        const ClauseNumberer: typeof ClauseNumbers.default = ((ClauseNumbers as any).default?.default ??
            (ClauseNumbers as any).default ??
            ClauseNumbers) as any
        const spec: SpecModule.default = new Spec(
            document.uri,
            () => Promise.resolve(''),
            js_document,
            {
                assets: 'none',
                extraBiblios: [
                    {
                        location: 'https://tc39.es/ecma262/',
                        // biome-ignore lint/suspicious/noExplicitAny: ...
                        entries: biblio as any,
                    },
                ],
                warn(error: { line?: number; column?: number; message: string; ruleId: string }) {
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
            clauseNumberer: ClauseNumberer(spec),
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
        pull_refresh_support: boolean | undefined,
    ) {
        const linter = new Diagnostics()
        const usePullDiagnostics = pull_capabilities !== undefined
        const usePushDiagnostics = !usePullDiagnostics && push_capabilities !== undefined
        const diagnosticRuns = new Map<string, number>()

        function startDiagnostic(uri: string) {
            const run = (diagnosticRuns.get(uri) ?? 0) + 1
            diagnosticRuns.set(uri, run)
            return run
        }

        const config = {
            enabled: false,
            enable(enable: boolean) {
                this.enabled = enable
                if (usePushDiagnostics) {
                    documents.all().forEach((document) => {
                        pushDiagnostics({ document })
                    })
                } else if (pull_refresh_support) {
                    void connection.sendRequest(DiagnosticRefreshRequest.type).catch(() => {})
                }
            },
        }

        const pushDiagnostics = (params: TextDocumentChangeEvent<TextDocument>) => {
            const document = params.document
            const uri = document.uri
            const run = startDiagnostic(uri)
            if (!config.enabled) {
                connection.sendDiagnostics({ uri, diagnostics: [] })
                return
            }
            const documentVersion = document.version
            linter.diagnostic(document, program, undefined).then((diagnostic) => {
                if (diagnosticRuns.get(uri) !== run || documents.get(uri)?.version !== documentVersion) return
                connection.sendDiagnostics({ uri, diagnostics: diagnostic })
            })
        }
        if (usePullDiagnostics) {
            connection.languages.diagnostics.on(
                async (params, token, workDoneProgress): Promise<DocumentDiagnosticReport> => {
                    if (!config.enabled) return { items: [], kind: 'full' }
                    const document = documents.get(params.textDocument.uri)
                    if (!document) return { items: [], kind: 'full' }
                    const run = startDiagnostic(document.uri)
                    const documentVersion = document.version
                    const diagnostic = await linter.diagnostic(document, program, params, token, workDoneProgress)
                    if (
                        diagnosticRuns.get(document.uri) !== run ||
                        documents.get(document.uri)?.version !== documentVersion
                    ) {
                        return { items: [], kind: 'full' }
                    }
                    return { items: diagnostic, kind: 'full' }
                },
            )
            serverCapabilities.diagnosticProvider = {
                documentSelector: null,
                interFileDependencies: false,
                workspaceDiagnostics: false,
            }
        } else if (usePushDiagnostics) {
            documents.onDidOpen(pushDiagnostics)
            documents.onDidChangeContent(pushDiagnostics)
        }
        return config
    }
}
