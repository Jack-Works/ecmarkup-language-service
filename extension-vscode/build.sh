#!/bin/bash
# npx esbuild ./src/web.ts                                               --bundle --platform=browser  --outfile=./lib/web.js                  --target=chrome114 --external:vscode --define:process.env.NODE_ENV='"production"'                                    --format=cjs --sourcemap
# npx esbuild ./node_modules/ecmarkup-language-server/src/server-web.ts  --bundle --platform=browser  --outfile=./lib/language-server-web.js  --target=chrome114                   --define:process.env.NODE_ENV='"production"'                                    --format=cjs --sourcemap
  npx esbuild ./src/node.ts                                              --bundle --platform=node     --outfile=./lib/node.js                 --target=node18.15 --external:vscode --define:process.env.NODE_ENV='"production"'                                    --format=cjs --sourcemap
  npx esbuild ./node_modules/ecmarkup-language-server/src/server-node.ts --bundle --platform=node     --outfile=./lib/language-server-node.js --target=node18.15                   --define:process.env.NODE_ENV='"production"' --define:require.resolve=undefined --format=cjs --sourcemap