import type {
    f32,
    u16,
    u10,
    u14,
    u32,
    u6,
    i11,
    u7,
} from 'ts-binarifier/src/type-aliases'

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

export type Username = string
export type MapName = string
export type AreaName = string

export type COMBATANT_PARTY = u16

export type ItemType = u10
export type ArmorType = i11
export type LevelType = u7

export type HpType = u32
export type AttackType = u14
export type DefenceType = u14
export type FocusType = u14
export type SpLevelType = u6
export type SpType = f32
export type ExpType = u10
