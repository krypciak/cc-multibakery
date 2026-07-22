import type { Username } from '../net/binary/binary-types'
import type { MapTpInfo } from '../server/server-types'
import type { Client } from './client'

declare global {
    namespace ig {
        var client: Client | undefined
    }
}

export type ClientSettings = {
    username: Username
    remote: boolean
    noShowInstance?: boolean
    forceDraw?: boolean
    tpInfo?: MapTpInfo
    tilingOrder?: number
} & (
    | {
          inputType: 'clone'
          initialInputType?: ig.INPUT_DEVICES
      }
    | {
          inputType: 'puppet'
      }
)
