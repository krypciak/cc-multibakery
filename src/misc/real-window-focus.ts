export {}

declare global {
    namespace ig {
        var isWindowFocused: boolean
    }
}

ig.Input.inject({
    blur(event) {
        this.parent(event)
        ig.isWindowFocused = false
    },
    focus() {
        this.parent()
        ig.isWindowFocused = true
    },
})
