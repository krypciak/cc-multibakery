export {}
sc.TitleScreenGui.inject({
    init(...args) {
        this.parent(...args)
        this.introGui.timeLine = [{ time: 0, end: true }]
        // @ts-expect-error
        this.bgGui.parallax.addLoadListener({
            onLoadableComplete: () => {
                let { timeLine } = this.bgGui
                // @ts-expect-error
                let idx = timeLine.findIndex(item => item.time > 0)
                if (idx < 0) idx = timeLine.length
                timeLine.splice(idx, 0, { time: 0, goto: 'INTRO_SKIP_NOSOUND' })
            },
        })
        this.removeChildGui(this.startGui)
        // @ts-expect-error
        this.startGui = {
            show: () => {
                ig.interact.removeEntry(this.screenInteract)
                this.buttons.show()
            },
            hide: () => {},
        }
    },
})
