import ts from 'typescript'
import { Node } from 'ts-binarifier/src/nodes/node'
import { green, yellow } from 'ts-binarifier/src/colors'
import { getRecordKeyType, getRecordValueType, TypeParser } from 'ts-binarifier/src/type-parser'
import { findVariableDeclaration } from 'ts-binarifier/src/type-extractor'
import { assert } from 'ts-binarifier/src/assert'
import { StringNode } from 'ts-binarifier/src/nodes/string'
import { StringEnumNode } from 'ts-binarifier/src/nodes/string-enum'
import { NumberNode, NumberType } from 'ts-binarifier/src/nodes/number'

class EntityStateRecordUnionNode extends Node {
    private recordSizeNode = new NumberNode(false, 10, NumberType.Unsigned)
    private netidNode = new StringNode(false, 63)
    private entityTypeNode: StringEnumNode

    constructor(
        optional: boolean | undefined,
        public values: Node[],
        private stringIds: string[]
    ) {
        super(optional)
        this.entityTypeNode = new StringEnumNode(false, stringIds, true)
    }

    print(noColor?: boolean, indent: number = 0, ignoreOptional?: boolean) {
        return (
            'EntityStateRecordUnion<' +
            yellow('XX') +
            green('rest') +
            ', \n' +
            this.values
                .map(
                    (v, i) =>
                        Node.indent(indent + 1) +
                        `/* id: ` +
                        yellow(`${i}`, noColor) +
                        ` (${this.entityTypeNode.unionIdNode.print(noColor)}) typeId: ` +
                        green(`'${this.stringIds[i]}' `, noColor) +
                        `*/ ` +
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
                `const ${idVar} = ` +
                this.entityTypeNode.genEncodeAccess({
                    ...data,
                    varName: `${netidVar}.substring(0, 2)`,
                    indent: data.indent + 1,
                }) +
                '\n' +
                Node.indent(data.indent + 1) +
                this.entityTypeNode.unionIdNode.genEncode({ ...data, varName: idVar, indent: data.indent + 1 }) +
                '\n' +
                Node.indent(data.indent + 1) +
                `switch (${idVar}) { \n` +
                this.values
                    .map(
                        (t, i) =>
                            Node.indent(data.indent + 2) +
                            `case ${i}: {\n` +
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
                `const ${idVar} = ` +
                this.entityTypeNode.unionIdNode.genDecode(data) +
                '\n' +
                Node.indent(data.indent + 1) +
                `let ${valueVar}: any\n` +
                Node.indent(data.indent + 1) +
                `switch (${idVar}) { \n` +
                this.values
                    .map(
                        (t, i) =>
                            Node.indent(data.indent + 2) +
                            `case ${i}: {\n` +
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
    assert(keyType.flags & ts.TypeFlags.String)

    const valueType = getRecordValueType(recordType)
    assert(valueType)
    assert(valueType.isUnion())
    const valueNodes = valueType.types.map(t => parser.parseToNode(t, indent + 1))

    const stringIds = valueType.types
        .map(t => findVariableDeclaration(t.symbol.valueDeclaration!.getSourceFile(), 'typeId', 6))
        .map(n => {
            assert(n.initializer)
            assert(ts.isStringLiteral(n.initializer))
            return n.initializer.text
        })

    return new EntityStateRecordUnionNode(optional, valueNodes, stringIds)
}
