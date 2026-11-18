import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

/**
 * 按钮审计脚本：扫描 src 目录下的 .tsx 字面量 <button>。
 *
 * 统计口径：
 * - 包含 src 下的测试文件（例如 *.interaction.test.tsx），因为它们也会被打包工具解析；
 * - 只统计字面量 <button>，不统计 <Button> / <TooltipButton> / 菜单项等封装组件；
 * - 绑定条件：onClick、onMouseDown、onPointerDown、type="submit" 或 JSX spread（处理器可能来自调用方）；
 * - 禁用状态不算未绑定，未绑定列表只记录没有任何上述属性的按钮。
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.join(root, 'src')
const outFile = path.join(root, 'docs', 'execution', 'BUTTON-AUDIT.json')

function collectTsxFiles(dir) {
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...collectTsxFiles(full))
    else if (entry.name.endsWith('.tsx')) files.push(full)
  }
  return files
}

function isStringLiteralType(attr, source) {
  return ts.isJsxAttribute(attr)
    && attr.name.getText(source) === 'type'
    && attr.initializer
    && ts.isStringLiteral(attr.initializer)
    && attr.initializer.text === 'submit'
}

const boundAttributes = new Set(['onClick', 'onMouseDown', 'onPointerDown'])
const unbound = []
let total = 0
let bound = 0

for (const file of collectTsxFiles(srcDir).sort()) {
  const sourceText = fs.readFileSync(file, 'utf8')
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

  function visit(node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node
      if (opening.tagName.getText(source) === 'button') {
        total++
        const attrs = opening.attributes.properties
        const attrNames = attrs.filter(ts.isJsxAttribute).map((attr) => attr.name.getText(source))
        const hasSpread = attrs.some(ts.isJsxSpreadAttribute)
        const hasSubmit = attrs.some((attr) => isStringLiteralType(attr, source))
        const hasHandler = attrNames.some((name) => boundAttributes.has(name))
        if (hasSpread || hasSubmit || hasHandler) {
          bound++
        } else {
          const pos = source.getLineAndCharacterOfPosition(opening.getStart(source))
          const label = node.children
            ? node.children.map((child) => child.getText(source)).join(' ').replace(/\s+/g, ' ').trim().slice(0, 100)
            : ''
          unbound.push({
            file: path.relative(root, file).replaceAll('\\', '/'),
            line: pos.line + 1,
            column: pos.character + 1,
            attributes: attrNames,
            label,
          })
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
}

const result = {
  scanner: 'scripts/audit-buttons.mjs',
  scope: {
    glob: 'src/**/*.tsx',
    includesTests: true,
    literalButtonOnly: true,
    boundBy: ['onClick', 'onMouseDown', 'onPointerDown', 'type=submit', 'JSXSpread'],
    excludes: ['<Button>', '<TooltipButton>', 'menu items and other component wrappers'],
  },
  summary: {
    total,
    bound,
    unbound: unbound.length,
  },
  unbound,
}

fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
console.log(`button audit: total=${total} bound=${bound} unbound=${unbound.length}`)
console.log(`written: ${path.relative(root, outFile).replaceAll('\\', '/')}`)
