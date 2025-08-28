import { poststart } from '../plugin'

function mapFor(baseFont: ig.MultiFont, iconsFont: ig.Font, icons: string[]) {
    const page = baseFont.iconSets.length
    baseFont.pushIconSet(iconsFont)
    const mapping: Record<string, [number, number]> = {}
    for (let i = 0; i < icons.length; i++) {
        mapping[icons[i]] = [page, i]
    }
    baseFont.setMapping(mapping)
}

poststart(() => {
    const iconsFont = new ig.Font('media/font/multibakery-icons.png', 16, 16)
    const icons = [
        //
        'multibakery-croissant',
    ]
    mapFor(sc.fontsystem.font, iconsFont, icons)
})
