import { BrowserMessageReader, BrowserMessageWriter, createConnection } from 'vscode-languageserver/browser.js'
import { initialize } from './server-shared.js'

const messageReader = new BrowserMessageReader(self)
const messageWriter = new BrowserMessageWriter(self)
initialize(createConnection(messageReader, messageWriter), 'web')
