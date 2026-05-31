import { prestart } from '../loading-stages'
import { addProxy } from '../state/entity/proxy-util'

declare global {
    namespace sc {
        var ASSAULT_PROJECTILES_CUSTOM: Record<sc.ELEMENT, sc.BallInfo>
    }
}

prestart(() => {
    if (!sc.ASSAULT_PROJECTILES_CUSTOM) return

    for (const element of Object.values(sc.ELEMENT).map(Number) as sc.ELEMENT[]) {
        addProxy(`assaultLqm${element}`, sc.ASSAULT_PROJECTILES_CUSTOM[element])
    }
})
