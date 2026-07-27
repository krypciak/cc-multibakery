export function runEvent({
    event,
    type,
    callEntity,
    allData = {},
    allInput,
    ignoreEventStepsCollection,
}: {
    event: ig.Event
    type: ig.EventRunType
    callEntity?: ig.Entity
    allData?: Record<string, unknown>
    allInput?: ig.Event.Vars
    ignoreEventStepsCollection?: boolean
}) {
    const eventCall = new ig.EventCall(event, allData, type)
    eventCall.callEntity = callEntity
    eventCall.stack[0].stepData = allData
    Object.assign(eventCall.stack[0].vars, allInput)
    // console.log( 'pushing event call to:', instanceinator.id, ', steps:', stepsSettings.map(({ type }) => type), 'call:', eventCall)

    eventCall.ignoreEventStepsCollection = ignoreEventStepsCollection

    if (!ig.game.events.blockingEventCall || type != ig.EventRunType.BLOCKING) {
        ig.game.events._startEventCall(eventCall)
    } else {
        eventCall.blocked = true
        ig.game.events.blockedEventCallQueue.push(eventCall)
    }

    return eventCall
}
