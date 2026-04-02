import type { f32, u16, u10, u14, u6, i11, u7, i32, f64, u8 } from 'ts-binarifier/src/type-aliases'

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

export type HpType = i32
export type AttackType = u14
export type DefenceType = u14
export type FocusType = u14
export type SpLevelType = u6
export type SpType = f32
export type ExpType = u10

export {}
declare global {
    namespace sc {
        namespace CombatParams {
            interface Params {
                hp: HpType
                attack: AttackType
                defense: DefenceType
                focus: FocusType

                elemFactor?: f64[]
                statusInflict?: f64[]
                statusEffect?: f64[]
            }
        }
        interface CombatParams {
            currentHp: HpType
            maxSp: SpLevelType
            currentSp: SpType
        }
        namespace PlayerModel {
            interface Equip {
                head: ArmorType
                leftArm: ArmorType
                rightArm: ArmorType
                torso: ArmorType
                feet: ArmorType
            }
        }
        interface PlayerModel {
            level: LevelType
            exp: ExpType
            skillPoints: u8[]
        }
    }
}
