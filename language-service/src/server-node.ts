import { createConnection, ProposedFeatures } from 'vscode-languageserver/node.js'
import { initialize } from './server-shared.js'

initialize(createConnection(ProposedFeatures.all))
