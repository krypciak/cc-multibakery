<!-- markdownlint-disable MD013 MD024 MD001 MD045 -->

# CrossCode coop/multiplayer (BETA)

Join for more info
[![](https://img.shields.io/discord/382339402338402315?logo=discord&logoColor=white&label=CrossCode%20Modding)](https://discord.gg/ZuqTeevse8)

## FAQ

### How to install the mod?

Join the discord server, go to #cc-multibakery channel, look at pins. There you will find a video tutorial on how to join the beta.  
For now it's quite convoluted, but that's on purpose. The mod will be added to the main repositories when v1.0.0 is reached.

### Can I do a regular playthrough?

No. The mod is still in beta and the current focus is making PVP stable. Don't bother.

### Where can I report bugs?

On the discord server above.

### How can I play with my friends?

#### Playing over LAN

1. Open the **Mod Manager** and open multibakery settings;
2. Enable **Server->Networking**
3. Start the server from the **pause screen**
4. Friends connected to the same local network should be able to find and join your server from the **Server** list

#### Playing over the internet

If your friends are not on the same local network, you need to make your server accessible to them. You can do this in one of two ways:

- **Expose the server to the internet** using a tunneling or port-forwarding solution such as playit.gg or ngrok
- **Create a virtual LAN** using a tool such as Tailscale or Hamachi (please don't actually use Hamachi), allowing everyone to connect as if they were on the same local network

Once connected through one of these methods, your friends should be able to find or connect to your server using the same process as LAN players

## Documentation

Recommend reading in order

- [SERVER-ARCHITECTURE.md](/docs/SERVER-ARCHITECTURE.md)
- [GAME-VARIABLES.md](/docs/GAME-VARIABLES.md)
- [EVENTS.md](/docs/EVENTS.md)
- [STEPS.md](/docs/STEPS.md)

## Building

```bash
git clone https://github.com/krypciak/cc-multibakery
cd cc-multibakery
pnpm install
pnpm run start
# this should return no errors (hopefully)
npx tsc
```
