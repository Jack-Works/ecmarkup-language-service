import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const repoName = 'ecmarkup-language-extension-vscode'
const publishName = 'ecmarkup'
const manifest = new URL('./extension-vscode/package.json', import.meta.url)
const file = readFileSync(manifest, 'utf-8')

spawnSync('yarn build', { shell: true, stdio: 'inherit' })
spawnSync('yarn build', { shell: true, stdio: 'inherit', cwd: new URL('./extension-vscode/', import.meta.url) })

writeFileSync(manifest, file.replace(repoName, publishName))
spawnSync('node ./node_modules/.bin/vsce publish --no-dependencies', { shell: true, stdio: 'inherit', cwd: new URL('./extension-vscode/', import.meta.url) })
writeFileSync(manifest, file)

spawnSync('yarn changeset tag', { shell: true, stdio: 'inherit' })
