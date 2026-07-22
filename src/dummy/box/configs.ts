import type { DummyBoxGuiConfig } from './box-addon'

import { config as usernameConfig } from './configs/username'
import { config as combatArtConfig } from './configs/combat-art'
import { config as elementalOverloadConfig } from './configs/elemental-overload'
import { config as noSpConfig } from './configs/no-sp'
import { config as combatantLabelConfig } from './configs/combatant-label'
import { config as menuConfig } from './configs/menu'

export const dummyBoxGuiConfigs: DummyBoxGuiConfig[] = [
    usernameConfig,
    combatArtConfig,
    elementalOverloadConfig,
    noSpConfig,
    combatantLabelConfig,
    menuConfig,
]
