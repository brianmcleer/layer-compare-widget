const { registerHooks } = require('node:module')
const { existsSync } = require('node:fs')
const { fileURLToPath, pathToFileURL } = require('node:url')
const path = require('node:path')

// Node 24 supplies TypeScript type stripping. No test dependency enters the widget bundle.
registerHooks({
  resolve (specifier, context, nextResolve) {
    if (specifier === 'jimu-arcgis') return { url: pathToFileURL(path.join(__dirname, 'sdk-stub.cjs')).href, shortCircuit: true }
    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      const candidate = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)
      if (existsSync(`${candidate}.ts`)) return { url: pathToFileURL(`${candidate}.ts`).href, shortCircuit: true }
    }
    return nextResolve(specifier, context)
  }
})
