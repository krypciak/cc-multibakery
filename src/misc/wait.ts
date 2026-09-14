export async function wait(timeMs: number) {
    await new Promise<void>(resolve => setTimeout(resolve, timeMs))
}
