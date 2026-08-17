const fakeEffect = { coll: { time: {} }, setIgnoreSlowdown() {} }
const fakeEffectSheet = {
    spawnOnTarget: (_name, _target, _settings) => fakeEffect,
    spawnFixed: (_name, _x, _y, _z, _target, _settings) => fakeEffect,
} as ig.EffectSheet

export function createFakeEffectSheet(): ig.EffectSheet {
    return fakeEffectSheet
}
