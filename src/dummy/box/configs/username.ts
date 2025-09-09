import { Opts } from '../../../options'
import { addDummyBoxGuiConfig } from '../configs'

addDummyBoxGuiConfig({
    yPriority: 0,

    textGetter: player => player.data.username,
    condition: player => !ig.client || !Opts.hideClientUsername || ig.client.username != player.data.username,
})
