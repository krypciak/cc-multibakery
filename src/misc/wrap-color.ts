export const COLOR = {
    WHITE: 0,
    RED: 1,
    GREEN: 2,
    YELLOW: 3,
} as const
export type COLOR = (typeof COLOR)[keyof typeof COLOR]

export function wrapColor(text: string, color: COLOR): string {
    return `\\c[${color}]${text}\\c[0]`
}
