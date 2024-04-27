import { ProposedFeatures, createConnection } from 'vscode-languageserver/node.js'
import { initialize } from './server-shared.js'

initialize(createConnection(ProposedFeatures.all))
