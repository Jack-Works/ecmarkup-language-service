import type { ExtensionContext, Uri } from 'vscode'
import { commands, Range, window, workspace } from 'vscode'
import type { LanguageClient as WebClient } from 'vscode-languageclient/browser'
import type { LanguageClient as NodeClient } from 'vscode-languageclient/node'
import {
    type InsertClauseParams,
    type InsertClauseResult,
    insertClauseRequest,
} from '../../../language-server/src/protocol.js'

type Client = NodeClient | WebClient

export function registerInsertClauseCommand(context: ExtensionContext, getClient: () => Client) {
    context.subscriptions.push(
        commands.registerCommand('ecmarkup.insertClause', async () => {
            const editor = window.activeTextEditor
            if (editor?.document.languageId !== 'ecmarkup') {
                await window.showWarningMessage('The active document is not an ecmarkup document.')
                return
            }

            const clauseNumber = await window.showInputBox({
                prompt: 'ecmarkup: Insert clause',
                placeHolder: 'e.g. 25.1.3',
                validateInput(value) {
                    return /^\d+(?:\.\d+)*$/u.test(value.trim()) ? undefined : 'Enter a clause number such as 25.1.3.'
                },
            })
            if (!clauseNumber) return

            const params: InsertClauseParams = {
                textDocument: { uri: editor.document.uri.toString() },
                position: editor.selection.active,
                clauseNumber,
                indentSize: getConfiguredIndentSize(editor.document.uri),
            }
            const edits = await getClient().sendRequest<InsertClauseResult>(insertClauseRequest, params)
            if (!edits) {
                await window.showInformationMessage(`No biblio clause was found for ${clauseNumber.trim()}.`)
                return
            }

            const applied = await editor.edit((editBuilder) => {
                for (const edit of edits) {
                    editBuilder.replace(
                        new Range(
                            edit.range.start.line,
                            edit.range.start.character,
                            edit.range.end.line,
                            edit.range.end.character,
                        ),
                        edit.newText,
                    )
                }
            })
            if (!applied) await window.showErrorMessage('Could not apply the inserted clause.')
        }),
    )
}

function getConfiguredIndentSize(uri: Uri) {
    const inspected = workspace.getConfiguration('editor', uri).inspect<number | 'auto'>('tabSize')
    const tabSize =
        inspected?.workspaceFolderLanguageValue ??
        inspected?.workspaceLanguageValue ??
        inspected?.workspaceFolderValue ??
        inspected?.workspaceValue ??
        inspected?.globalLanguageValue ??
        inspected?.globalValue
    return typeof tabSize === 'number' ? tabSize : undefined
}
