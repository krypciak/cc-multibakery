import ts from 'typescript'
import { Node } from 'ts-binarifier/src/nodes/node'
import { gray, yellow } from 'ts-binarifier/src/colors'
import { getRecordKeyType, getRecordValueType, TypeParser } from 'ts-binarifier/src/type-parser'
import { assert } from 'ts-binarifier/src/assert'
import { NumberNode, NumberType } from 'ts-binarifier/src/nodes/number'

class EntityStateRecordUnionNode extends Node {
    private recordSizeNode = new NumberNode(false, 10, NumberType.Unsigned)

    constructor(
        optional: boolean | undefined,
        private netidNode: NumberNode,
        public values: Node[]
    ) {
        super(optional)
    }

    print(noColor?: boolean, indent: number = 0, ignoreOptional?: boolean) {
        return (
            'EntityStateRecordUnion<' +
            this.netidNode.print() +
            ', \n' +
            this.values
                .map(
                    (v, i) =>
                        Node.indent(indent + 1) +
                        gray(`/* id: `, noColor) +
                        yellow(`${i+1}`, noColor) +
                        gray(` */ `, noColor) +
                        v.print(noColor, indent + 1)
                )
                .join(' | \n') +
            '>' +
            this.optionalSuffix(ignoreOptional, noColor)
        )
    }

    genEncode(data: GenEncodeData): string {
        const netidVar = `k${data.varCounter.v++}`
        const valueVar = `v${data.varCounter.v++}`
        const idVar = `id${data.varCounter.v++}`
        const entriesVar = `entries${data.varCounter.v++}`
        data.imports.push(`import { getEntityTypeId } from '../../misc/entity-netid'`)

        return this.genEncodeWrapOptional(
            data,
            data =>
                `const ${entriesVar} = Object.entries(${data.varName}) as unknown as [keyof typeof ${data.varName}, any][]\n` +
                Node.indent(data.indent) +
                this.recordSizeNode.genEncode({ ...data, varName: `${entriesVar}.length` }) +
                '\n' +
                Node.indent(data.indent) +
                `for (const [${netidVar}, ${valueVar}] of ${entriesVar}) {\n` +
                Node.indent(data.indent + 1) +
                this.netidNode.genEncode({ ...data, varName: netidVar, indent: data.indent + 1 }) +
                '\n' +
                Node.indent(data.indent + 1) +
                `const ${idVar} = getEntityTypeId(${netidVar})` +
                '\n' +
                Node.indent(data.indent + 1) +
                `switch (${idVar}) { \n` +
                this.values
                    .map(
                        (t, i) =>
                            Node.indent(data.indent + 2) +
                            `case ${i+1}: {\n` +
                            Node.indent(data.indent + 3) +
                            t.genEncode({ ...data, varName: valueVar, indent: data.indent + 3 }) +
                            '\n' +
                            Node.indent(data.indent + 3) +
                            `break\n` +
                            Node.indent(data.indent + 2) +
                            `}\n`
                    )
                    .join('') +
                Node.indent(data.indent + 1) +
                `}\n` +
                Node.indent(data.indent) +
                `}`
        )
    }

    genDecode(data: GenDecodeData): string {
        const netidVar = `netid${data.varCounter.v++}`
        const valueVar = `v${data.varCounter.v++}`
        const idVar = `id${data.varCounter.v++}`
        return this.genDecodeWrapOptional(
            `Object.fromEntries(new Array(` +
                this.recordSizeNode.genDecode({ ...data }) +
                `).fill(null).map(_ => {\n` +
                Node.indent(data.indent + 1) +
                `const ${netidVar} = ` +
                this.netidNode.genDecode(data) +
                '\n' +
                Node.indent(data.indent + 1) +
                `const ${idVar} = getEntityTypeId(${netidVar})` +
                '\n' +
                Node.indent(data.indent + 1) +
                `let ${valueVar}: any\n` +
                Node.indent(data.indent + 1) +
                `switch (${idVar}) { \n` +
                this.values
                    .map(
                        (t, i) =>
                            Node.indent(data.indent + 2) +
                            `case ${i+1}: {\n` +
                            Node.indent(data.indent + 3) +
                            `${valueVar} = ` +
                            t.genDecode({ ...data, indent: data.indent + 3 }) +
                            '\n' +
                            Node.indent(data.indent + 3) +
                            `break\n` +
                            Node.indent(data.indent + 2) +
                            `}\n`
                    )
                    .join('') +
                Node.indent(data.indent + 1) +
                `}\n` +
                Node.indent(data.indent + 1) +
                `return [${netidVar}, ${valueVar}]\n` +
                Node.indent(data.indent) +
                `}))`
        )
    }
}

import * as fs from 'fs'
import * as path from 'path'
const entityImportOrder = (await fs.promises.readFile('src/state/entity.ts', 'utf8'))
    .split('\n')
    .filter(line => line.startsWith("import './entity/"))
    .map(line => line.slice("import './entity/".length, -1))
    .filter(line => line.startsWith('sc') || line.startsWith('ig') || line.startsWith('dummy'))
// console.log(entityImportOrder)

export function createEntityStateRecordUnionNode(
    optional: boolean | undefined,
    types: ts.Type[],
    parser: TypeParser,
    indent: number
): Node {
    assert(types.length == 1)
    const recordType = types[0]
    const keyType = getRecordKeyType(recordType)
    assert(keyType)
    const keyNode = parser.parseToNode(keyType, indent + 1)
    assert(keyNode instanceof NumberNode)

    const valueType = getRecordValueType(recordType)
    assert(valueType)
    assert(valueType.isUnion())
    const valueNodesUnsorted = valueType.types.map(t => parser.parseToNode(t, indent + 1))
    const valueNodesUnsortedTypeNames = valueType.types.map(t =>
        path.basename(t.symbol.getDeclarations()?.[0]?.getSourceFile().fileName!).slice(0, -3)
    )
    assert(entityImportOrder.length == valueNodesUnsortedTypeNames.length)
    // console.log(valueNodesUnsortedTypeNames)
    const valueNodes: Node[] = entityImportOrder.map(
        typeName => valueNodesUnsorted[valueNodesUnsortedTypeNames.findIndex(typeName1 => typeName == typeName1)]
    )
    // console.log(valueNodes)
    // process.exit()

    return new EntityStateRecordUnionNode(optional, keyNode, valueNodes)
}
