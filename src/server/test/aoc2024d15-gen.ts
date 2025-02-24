import * as fs from 'fs'
;(async () => {
    const map = `
########
#..O.O.#
##@.O..#
#...O..#
#.#.O..#
#...O..#
#......#
########
`.trim()
    // const moves = `<^^>>>vv<v>>v<<`

    const mapSp = map.split('\n')
    const boardSize = { x: mapSp[0].length, y: mapSp.length }

    let baseMap: sc.MapModel.Map
    if (boardSize.x == 8 && boardSize.y == 8) {
        baseMap = JSON.parse(
            await fs.promises.readFile('../../../assets/data/maps/multibakery/test/aoc8x8base.json', 'utf-8')
        )
    } else throw new Error('unsupported map size')

    const startX = 1
    const startY = 8
    const coll = baseMap.layer[2].data
    const bg = baseMap.layer[0].data
    const wall = baseMap.layer[4].data
    const entities = baseMap.entities

    function addMarker(mx: number, my: number) {
        entities.push({
            type: 'Marker',
            x: mx * 16 - 8,
            y: my * 16 - 8,
            level: 0,
            settings: { size: { x: 16, y: 16 }, mapId: 2, dir: 'NORTH', name: 'start' },
        })
    }
    let mapId = 0
    function addBox(mx: number, my: number) {
        mapId++
        entities.push({
            type: 'WavePushPullBlock',
            x: mx * 16,
            y: my * 16,
            level: 0,
            settings: {},
        })
    }

    for (let y = 1; y < boardSize.y - 1; y++) {
        for (let x = 1; x < boardSize.x - 1; x++) {
            let c = mapSp[y][x]
            let mx = (x - 1) * 2 + startX
            let my = (y - 1) * 2 + startY
            if (c == '#') {
                coll[my][mx] = coll[my + 1][mx] = coll[my][mx + 1] = coll[my + 1][mx + 1] = 2
                wall[my - 1][mx] = 257
                bg[my][mx] = 321
                bg[my + 1][mx] = 353
                wall[my - 1][mx + 1] = 259
                bg[my][mx + 1] = 323
                bg[my + 1][mx + 1] = 355
            } else if (c == 'O') {
                addBox(mx, my)
            } else if (c == '@') {
                addMarker(mx, my)
            }
        }
    }

    await fs.promises.writeFile('../../../assets/data/maps/multibakery/test/aoc8x8-1.json', JSON.stringify(baseMap))
})()
