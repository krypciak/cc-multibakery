interface MacroSettings {
    name: string
    args?: string[]
    argsDepth?: number
    argsDefault?: Record<string, any>
    steps: any[]
}

declare global {
    namespace ig {
        namespace EVENT_STEP {
            namespace DEFINE_MACRO {
                interface Settings extends MacroSettings {}
            }
            interface DEFINE_MACRO extends ig.EventStepBase {}
            interface DEFINE_MACRO_CONSTRUCTOR extends ImpactClass<DEFINE_MACRO> {
                new (settings: ig.EVENT_STEP.DEFINE_MACRO.Settings): DEFINE_MACRO
            }
            var DEFINE_MACRO: DEFINE_MACRO_CONSTRUCTOR

            namespace MACRO {
                interface Settings {
                    name: string
                    [arg: string]: any
                }
            }
            interface MACRO extends ig.EventStepBase {}
            interface MACRO_CONSTRUCTOR extends ImpactClass<MACRO> {
                new (settings: ig.EVENT_STEP.MACRO.Settings): MACRO
            }
            var MACRO: MACRO_CONSTRUCTOR
        }
        namespace ACTION_STEP {}
    }
}

const macros = new Map<string, MacroSettings>()
function addMacro(macro: MacroSettings) {
    macros.set(macro.name, macro)
}

function prepareBody(body: any, args: Record<string, any>, depth: number) {
    if (depth < -100) return body

    function handleString(v: string) {
        if (depth < 0) return [v]
        
        let sp = v.split(' ')
        for (let i = 0; i < sp.length; i++) {
            const name = sp[i]
            if (args[name] !== undefined) sp[i] = args[name]
        }
        sp = sp.flat()
        if (sp.every(s => typeof s === 'string')) return [sp.join(' ')]
        return prepareBody(sp, args, depth - 1)
    }
    if (Array.isArray(body)) {
        body = applyStepMacros(body)
        const arr: any[] = []
        for (const v of body) {
            if (typeof v === 'string') {
                arr.push(...handleString(v))
            } else if (typeof v === 'object') {
                arr.push(prepareBody(v, args, depth - 1))
            } else {
                arr.push(v)
            }
        }
        return arr
    } else {
        const newBody = { ...body }
        for (const key in body) {
            const v = body[key]
            if (typeof v === 'string') {
                newBody[key] = handleString(v)[0]
            } else if (typeof v === 'object') {
                newBody[key] = prepareBody(v, args, depth - 1)
            }
        }
        return newBody
    }
}

export function applyStepMacros<T extends ig.EventStepBase.Settings[] | ig.ActionStepBase.Settings[]>(steps: T): T {
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i]
        if (step.type == 'DEFINE_MACRO') {
            addMacro(step)
            steps.splice(i, 1)
            i--
        } else if (step.type == 'MACRO') {
            const name = step.name
            const macro = macros.get(name)
            if (!macro)
                throw new Error(`Macro: ${name} not found!`)

                // @ts-expect-error
            ;(delete step['type'], delete step['name'])

            if (macro.args) {
                for (const argName of macro.args) {
                    if (step[argName] === undefined) throw new Error(`Macro: "${name}" missing argument: "${argName}"`)
                }
            }
            if (macro.argsDefault) {
                for (const argName in macro.argsDefault) {
                    if (step[argName] === undefined) {
                        let def = macro.argsDefault[argName]
                        if (typeof def === 'function') def = def()
                        step[argName] = def
                    }
                }
            }

            const body = prepareBody(macro.steps, step, macro.argsDepth ?? 50)

            steps.splice(i, 1, ...body)
            i += body.length - 1
        }
    }

    return steps
}

let uniqueCounter = 0
function nextUniqueNumber(): number {
    return uniqueCounter++
}

addMacro({
    name: 'FOR',
    args: ['to', 'steps'],
    argsDepth: 2,
    argsDefault: {
        loopName: () => 'forStart' + nextUniqueNumber(),
        i: () => 'forI' + nextUniqueNumber(),
        from: 0,
    },
    steps: [
        { type: 'CHANGE_VAR_NUMBER', changeType: 'set', varName: 'i', value: 'from' },
        { type: 'LABEL', name: 'loopName' },
        'steps',
        { type: 'CHANGE_VAR_NUMBER', changeType: 'add', varName: 'i', value: 1 },
        { type: 'GOTO_LABEL_WHILE', name: 'loopName', condition: 'i < to' },
    ],
})
