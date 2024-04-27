import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const repoName = 'ecmarkup-language-extension-vscode'
const publishName = 'ecmarkup'
const manifest = new URL('./extension-vscode/package.json', import.meta.url)
const file = readFileSync(manifest, 'utf-8')

spawnSync('pnpm run build', { shell: true, stdio: 'inherit' })
writeFileSync(manifest, file.replace(repoName, publishName))
spawnSync('pnpm -C extension-vscode run vsce-publish', { shell: true, stdio: 'inherit' })
writeFileSync(manifest, file)
spawnSync('npx changeset tag', { shell: true, stdio: 'inherit' })
