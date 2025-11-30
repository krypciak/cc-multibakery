export function runEvent(
    event: ig.Event,
    type: ig.EventRunType,
    callEntity?: ig.Entity,
    allData: Record<string, unknown> = {},
    noUpdate?: boolean
) {
    const eventCall = new ig.EventCall(event, allData, type)
    eventCall.callEntity = callEntity
    eventCall.stack[0].stepData = allData
    // console.log( 'pushing event call to:', instanceinator.id, ', steps:', stepsSettings.map(({ type }) => type), 'call:', eventCall)

    if (!ig.game.events.blockingEventCall || type != ig.EventRunType.BLOCKING) {
        ig.game.events._startEventCall(eventCall)
    } else {
        eventCall.blocked = true
        ig.game.events.blockedEventCallQueue.push(eventCall)
    }
    if (!noUpdate) ig.game.events.update()

    return eventCall
}
