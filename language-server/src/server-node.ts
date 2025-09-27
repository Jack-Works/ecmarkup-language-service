import { createConnection, ProposedFeatures } from 'vscode-languageserver/node.js'
import pkg from '../package.json' with { type: 'json' }
import { initialize } from './server-shared.js'

initialize(createConnection(ProposedFeatures.all), pkg.version)
