import { assert } from '../misc/assert'
import { prestart } from '../plugin'

declare global {
    namespace sc {
        interface ProxySpawnerBase {
            proxyType?: string
        }
    }
}

const proxyTypeToSpawner: Map<string, sc.ProxySpawnerBase> = new Map()
function addProxy(key: string, proxy: sc.ProxySpawnerBase) {
    proxy.proxyType = key
    proxyTypeToSpawner.set(key, proxy)
}

prestart(() => {
    for (const element of Object.values(sc.ELEMENT).map(Number) as sc.ELEMENT[]) {
        addProxy(`assault${element}`, sc.ASSAULT_PROJECTILES[element])
    }

    sc.PlayerConfig.inject({
        onload(data) {
            this.parent(data)
            for (const key in this.proxies) {
                addProxy(`${this.name}_${key}`, this.proxies[key])
            }
        },
    })
})

export function resolveProxyFromType(key: string): sc.ProxySpawnerBase {
    if (!key) throw new Error(`Proxy key undefined!`)
    const proxy = proxyTypeToSpawner.get(key)
    assert(proxy)
    return proxy
}

declare global {
    namespace ig.ENTITY {
        interface Ball {
            proxyType: string
        }
    }
}
prestart(() => {
    sc.BallInfo.inject({
        spawn(x, y, z, entity, dir) {
            const ball = this.parent(x, y, z, entity, dir)
            if (multi.server) {
                ball.proxyType = this.proxyType!
                if (!ball.proxyType) {
                    console.warn('sc.BallInfo#proxyType is undefined!')
                    debugger
                }
            }
            return ball
        },
    })
})
