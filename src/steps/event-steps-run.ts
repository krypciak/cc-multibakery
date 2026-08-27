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
    const eventCall = ig.game.events.callEvent(event, type, null, null, allInput, callEntity, allData)
    eventCall.stack[0].stepData = allData
    Object.assign(eventCall.stack[0].vars, allInput)
    eventCall.ignoreEventStepsCollection = ignoreEventStepsCollection

    return eventCall
}
