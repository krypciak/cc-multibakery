export NODE_NO_WARNINGS=1
killServer() {
    ps aux | grep "npm exec node server.js" | grep -v "grep" | awk '{print $2}' | xargs -I _ kill _
}
while true; do
    trap 'killServer' SIGINT
    clear
    if ! npx node server.js; then
        read -r
    fi
    trap - SIGINT
    sleep 0.1
done
