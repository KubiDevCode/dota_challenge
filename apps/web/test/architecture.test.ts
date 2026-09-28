import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const src = resolve(dirname(fileURLToPath(import.meta.url)), '../src')
const layers = ['app', 'pages', 'widgets', 'features', 'entities', 'shared']

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = join(dir, entry.name)
    return entry.isDirectory() ? files(file) : /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file) ? [file] : []
  })
}

it('keeps FSD import direction, slice isolation and public entrypoints', () => {
  const violations: string[] = []
  for (const file of files(src)) {
    const parts = relative(src, file).split(sep)
    const layer = parts[0]
    if (!layers.includes(layer)) continue
    const content = readFileSync(file, 'utf8')
    if (layer === 'pages' && /\bfetch\s*\(/.test(content)) violations.push(`${file}: page calls fetch`)
    for (const match of content.matchAll(/(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"](\.[^'"]+)['"]/g)) {
      const target = resolve(dirname(file), match[1])
      const targetParts = relative(src, target).split(sep)
      const targetLayer = targetParts[0]
      if (!layers.includes(targetLayer)) continue
      const currentRank = layers.indexOf(layer)
      const targetRank = layers.indexOf(targetLayer)
      if (targetRank < currentRank) violations.push(`${file}: imports upper layer ${match[1]}`)
      if (['pages', 'widgets', 'features', 'entities'].includes(layer)) {
        if (layer === targetLayer && parts[1] !== targetParts[1]) violations.push(`${file}: imports sibling slice ${match[1]}`)
      }
      if (['pages', 'widgets', 'features', 'entities'].includes(targetLayer) && (layer !== targetLayer || parts[1] !== targetParts[1])) {
        if (targetParts.length !== 2) violations.push(`${file}: deep imports ${match[1]}`)
      }
    }
  }
  expect(violations).toEqual([])
})
