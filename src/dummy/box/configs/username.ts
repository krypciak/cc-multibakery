import { Opts } from '../../../options'
import type { DummyBoxGuiConfig } from '../box-addon'

export const config: DummyBoxGuiConfig = {
    yPriority: 0,

    textGetter: player => player.username,
    condition: player => !ig.client || !Opts.hideClientUsername || ig.client.username != player.username,
}
