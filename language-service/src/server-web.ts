import { createConnection, BrowserMessageReader, BrowserMessageWriter } from 'vscode-languageserver/browser.js'
import { initialize } from './server-shared.js'

const messageReader = new BrowserMessageReader(self)
const messageWriter = new BrowserMessageWriter(self)
initialize(createConnection(messageReader, messageWriter))
