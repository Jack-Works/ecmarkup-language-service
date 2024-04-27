import { ProposedFeatures, createConnection } from 'vscode-languageserver/node.js'
import { initialize } from './server-shared.js'
import pkg from '../package.json' assert { type: 'json' }

initialize(createConnection(ProposedFeatures.all), pkg.version)
