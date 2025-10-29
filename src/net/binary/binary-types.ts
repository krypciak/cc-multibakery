import { f32, u16 } from 'ts-binarifier/src/type-aliases'

export {}
declare global {
    interface Vec2 {
        x: f32
        y: f32
    }
    interface Vec3 {
        x: f32
        y: f32
        z: f32
    }
}

export type COMBATANT_PARTY = u16
