import ts from 'typescript'
import { Node } from 'ts-binarifier/src/nodes/node'
import { green, yellow } from 'ts-binarifier/src/colors'
import { getRecordKeyType, getRecordValueType, TypeParser } from 'ts-binarifier/src/type-parser'
import { NumberNode } from 'ts-binarifier/src/nodes/number'
import { findVariableDeclaration } from 'ts-binarifier/src/type-extractor'
import { assert } from 'ts-binarifier/src/assert'
import { StringNode } from 'ts-binarifier/src/nodes/string'

class EntityStateRecordUnionNode extends Node {
    private unionIdNode: NumberNode
    private netidNode = new StringNode(false, 63)

    constructor(
        optional: boolean | undefined,
        public values: Node[],
        private stringIds: string[]
    ) {
        super(optional)
        this.unionIdNode = NumberNode.optimalForRange(false, 0, values.length)
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
                        ` (${this.unionIdNode.print(noColor)}) typeId: ` +
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

        return this.genEncodeWrapOptional(
            data,
            data =>
                `encoder.u16(Object.keys(${data.varName}).length)\n` +
                Node.indent(data.indent) +
                `for (const [${netidVar}, ${valueVar}] of Object.entries(${data.varName}) as unknown as [keyof typeof ${data.varName}, any][]) {\n` +
                Node.indent(data.indent + 1) +
                this.netidNode.genEncode({ ...data, varName: netidVar }) +
                '\n' +
                Node.indent(data.indent + 1) +
                `const ${idVar} = ` +
                `[${this.stringIds.map(id => `'${id}'`).join(', ')}]` +
                `.indexOf(${netidVar}.substring(0, 2))` +
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
            `Object.fromEntries(new Array(decoder.u16()).fill(null).map(_ => {\n` +
                Node.indent(data.indent + 1) +
                `const ${netidVar} = ` +
                this.netidNode.genDecode(data) +
                '\n' +
                Node.indent(data.indent + 1) +
                `const ${idVar} = ` +
                `[${this.stringIds.map(id => `'${id}'`).join(', ')}]` +
                `.indexOf(${netidVar}.substring(0, 2))` +
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
