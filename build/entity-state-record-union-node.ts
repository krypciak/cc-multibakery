import ts from 'typescript'
import { Node } from 'ts-binarifier/src/nodes/node'
import { gray, yellow } from 'ts-binarifier/src/colors'
import type { TypeParser } from 'ts-binarifier/src/type-parser'
import { getRecordKeyType } from 'ts-binarifier/src/type-parser'
import { assert } from 'ts-binarifier/src/assert'
import { NumberNode, NumberType } from 'ts-binarifier/src/nodes/number'

class EntityStateRecordUnionNode extends Node {
    private recordSizeNode = new NumberNode(false, 10, NumberType.Unsigned)

    constructor(
        optional: boolean | undefined,
        private netidNode: NumberNode,
        public values: { node: Node; name: string }[]
    ) {
        super(optional)
    }

    toString(shr: SharedPrintConfig, ind: IndividualPrintConfig) {
        return this.toStringWrapInOptionalUnion(
            shr,
            ind,
            'EntityStateRecordUnion<' +
                this.netidNode.toString(shr, { indent: ind.indent + 1 }) +
                ', \n' +
                this.values
                    .map(
                        ({ node, name }, i) =>
                            Node.indent(ind.indent + 1) +
                            gray(`/* `, shr.noColor) +
                            gray(name, shr.noColor) +
                            gray(` id: `, shr.noColor) +
                            yellow(`${i + 1}`, shr.noColor) +
                            gray(` */ `, shr.noColor) +
                            node.toString(shr, { indent: ind.indent + 1 })
                    )
                    .join(' | \n') +
                '>'
        )
    }
    private sanitizeEntityNameForFunctionName(name: string) {
        return name.replace(/\./g, '_')
    }

    genEncode(data: GenEncodeData): string {
        const netidVar = `netid`
        const valueVar = `data`
        const idVar = `typeId`
        const entriesVar = `entries`
        addImport(data.imports, '../../misc/entity-netid', 'getEntityTypeId')

        const functions: FunctionConfig[] = this.values.map(({ node, name }) =>
            getOrDefineFunction(data, {
                name: 'encodeEntity_' + this.sanitizeEntityNameForFunctionName(name),
                arguments: ['encoder: Encoder', `data: EntityStates['${name}']`],
                body: node.genEncode({ ...data, varName: 'data', indent: 0 }),
            })
        )

        addImport(data.imports, '../../state/entity', 'EntityStateRecord', true)

        const statesVar = 'states'
        const mainFunction = getOrDefineFunction(data, {
            name: 'encodeEntityStates',
            arguments: ['encoder: Encoder', `${statesVar}: EntityStateRecord`],
            body:
                `const ${entriesVar} = Object.entries(${statesVar}) as unknown as [keyof typeof ${statesVar}, any][]\n` +
                this.recordSizeNode.genEncode({ ...data, indent: 0, varName: `${entriesVar}.length` }) +
                '\n' +
                `for (const [${netidVar}, ${valueVar}] of ${entriesVar}) {\n` +
                Node.indent(1) +
                this.netidNode.genEncode({ ...data, varName: netidVar, indent: 1 }) +
                '\n' +
                Node.indent(1) +
                `const ${idVar} = getEntityTypeId(${netidVar})` +
                '\n' +
                Node.indent(1) +
                `switch (${idVar}) { \n` +
                this.values
                    .map(
                        ({}, i) =>
                            Node.indent(2) +
                            `case ${i + 1}: { ` +
                            `this.${functions[i].name}(encoder, ${valueVar}); ` +
                            `break; ` +
                            `}\n`
                    )
                    .join('') +
                Node.indent(1) +
                `}\n` +
                `}`,
        })

        return this.genEncodeWrapOptional(data, data => `this.${mainFunction.name}(encoder, ${data.varName})`)
    }

    genDecode(data: GenDecodeData): string {
        const functions: FunctionConfig[] = this.values.map(({ node, name }) =>
            getOrDefineFunction(data, {
                name: 'decodeEntity_' + this.sanitizeEntityNameForFunctionName(name),
                arguments: ['decoder: Decoder'],
                returnType: `EntityStates['${name}']`,
                body: 'return ' + node.genDecode({ ...data, indent: 0 }),
            })
        )

        addImport(data.imports, '../../misc/entity-netid', 'EntityNetid', true)

        const subFunction = getOrDefineFunction(data, {
            name: 'decodeEntityState',
            arguments: ['decoder: Decoder', 'netid: EntityNetid'],
            body:
                `const typeId = getEntityTypeId(netid)\n` +
                `switch (typeId) {\n` +
                this.values
                    .map(({}, i) => Node.indent(1) + `case ${i + 1}: ` + `return this.${functions[i].name}(decoder)\n`)
                    .join('') +
                `}\n` +
                `return {}`,
        })

        const mainFunction = getOrDefineFunction(data, {
            name: 'decodeEntityStates',
            arguments: ['decoder: Decoder'],
            body:
                `const len = ${this.recordSizeNode.genDecode({ ...data })}\n` +
                `const record: EntityStateRecord = {}\n` +
                `for (let i = 0; i < len; i++) {\n` +
                Node.indent(1) +
                `const netid = ${this.netidNode.genDecode(data)}\n` +
                Node.indent(1) +
                `record[netid] = this.${subFunction.name}(decoder, netid)\n` +
                `}\n` +
                `return record`,
        })

        return this.genDecodeWrapOptional(`this.${mainFunction.name}(decoder)`)
    }
}

import * as fs from 'fs'
import type {
    FunctionConfig,
    GenDecodeData,
    GenEncodeData,
    IndividualPrintConfig,
    SharedPrintConfig,
} from 'ts-binarifier/src/types'
import { addImport } from 'ts-binarifier/src/code-gen-imports'
import { getOrDefineFunction } from 'ts-binarifier/src/code-gen-functions'
const entityImportOrder = (await fs.promises.readFile('src/state/entity-all.ts', 'utf8'))
    .split('\n')
    .filter(line => line.startsWith("import './entity/"))
    .map(line => line.trim().slice("import './entity/".length, -1))
    .filter(line => line.startsWith('sc') || line.startsWith('ig') || line.startsWith('dummy'))
    .map(line => line.replace(/_/g, '.'))

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

    const node = recordType.symbol.declarations?.[0]
    assert(node)
    const sourceFile = node.getSourceFile()
    assert(sourceFile)
    const globalSymbols = parser.checker.getSymbolsInScope(sourceFile, ts.SymbolFlags.Interface)
    const entityStatesSymbol = globalSymbols.find(m => m.name == 'EntityStates')
    assert(entityStatesSymbol)
    const membersTable = entityStatesSymbol?.members
    assert(membersTable)
    const members = [...membersTable.values()]
    const valueNodesUnsorted = members.map(m => parser.checker.getTypeOfSymbol(m)).map(t => parser.parseToNode(t))
    const valueNodesUnsortedTypeNames = members.map(m => m.name)

    assert(entityImportOrder.length == valueNodesUnsortedTypeNames.length)
    // console.log(valueNodesUnsortedTypeNames)
    const nodes = entityImportOrder.map(typeName => ({
        node: valueNodesUnsorted[valueNodesUnsortedTypeNames.findIndex(typeName1 => typeName == typeName1)],
        name: typeName,
    }))

    return new EntityStateRecordUnionNode(optional, keyNode, nodes)
}
