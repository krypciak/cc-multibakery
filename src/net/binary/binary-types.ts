import {
    type f32,
    type u16,
    type u10,
    type u14,
    type u32,
    type u6,
    type i11,
    type u7,
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
