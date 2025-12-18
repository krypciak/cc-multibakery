export const copy: <T>(obj: T) => T = window.structuredClone ?? (obj => JSON.parse(JSON.stringify(obj)))
// function copy<T>(obj: T): T {
//     if (!obj || typeof obj !== 'object') return obj
//     if (Array.isArray(obj)) {
//         const newObj = []
//         for (let i = 0; i < obj.length; i++) newObj[i] = copy(obj[i])
//         return newObj as T
//     }
//     const newObj = {} as T
//     for (const key in obj) newObj[key] = copy(obj[key])
//     return newObj
// }
