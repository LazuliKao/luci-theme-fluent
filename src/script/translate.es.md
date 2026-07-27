# Translation guidance

You are translating luci-theme-fluent LuCI interface copy into Spanish (`es`).

Translation goals: keep the text concise, natural, and appropriate for a router/web UI while improving terminology accuracy, consistency, and professionalism. The result should read like polished OpenWrt / LuCI interface copy, not explanatory prose.

## Core rules

1. Use concise, professional, natural technical UI Spanish.
2. Prefer short labels and short sentences.
3. Keep terminology consistent across the entire file.
4. Translate for UI context, not word-for-word.
5. Do not add information that is not present in the source.
6. Preserve product names, project names, and technical names:
   - LuCI stays `LuCI`
   - Fluent stays `Fluent`
   - FluentUI stays `FluentUI`
   - View Transition API stays `View Transition API`
7. Keep all variables, placeholders, and format specifiers unchanged, including `%s`, `{count}`, and inline code.
8. If `luci-theme-fluent` appears as a package or project name, keep it unchanged. In natural descriptions of the theme itself, `tema Fluent` is acceptable.

## Terminology

Use these preferred translations consistently:

- theme → tema
- color mode → modo de color
- light mode → modo claro
- dark mode → modo oscuro
- accent color → color de acento
- login page → página de inicio de sesión
- card → tarjeta
- login card → tarjeta de inicio de sesión
- opacity → opacidad
- transparent → transparente
- opaque → opaco
- blur → desenfoque
- blur radius → radio de desenfoque
- backdrop → fondo
- backdrop blur → desenfoque de fondo
- backdrop blur radius → radio de desenfoque de fondo
- behind the login card → detrás de la tarjeta de inicio de sesión
- navigation → navegación
- sidebar → barra lateral
- tab → pestaña
- tab menu → menú de pestañas
- active underline → subrayado activo
- animation → animación
- transition → transición
- page transition → transición de página
- loading indicator → indicador de carga
- loading bar → barra de carga
- top loading bar → barra de carga superior
- toggle → alternar
- control → control
- control height → altura del control
- input → entrada
- select → selección
- dropdown → menú desplegable
- font weight → grosor de fuente
- semibold → semi-negrita
- reduced-motion preference → preferencia de movimiento reducido

## Style requirements

### Short labels

Keep short labels compact. Do not add unnecessary words like "configuración", "efecto", or "color", unless omitting them would create ambiguity.

Recommended examples:

- Animation → Animación
- Colors → Colores
- General → General
- Login page → Página de inicio de sesión
- Theme settings → Configuración del tema
- Control height → Altura del control

### Mode-related settings

Use compact phrasing for light/dark mode settings.

Recommended examples:

- Dark mode accent color → Color de acento en modo oscuro
- Light mode accent color → Color de acento en modo claro
- Dark mode page background → Fondo de página en modo oscuro
- Light mode page background → Fondo de página en modo claro

### Action text

Keep action labels short and direct.

Recommended examples:

- Follow system → Seguir el sistema
- Force dark mode → Forzar modo oscuro
- Force light mode → Forzar modo claro
- Toggle dark mode → Alternar modo oscuro
- Choose color → Elegir color
- Show top loading bar → Mostrar barra de carga superior

## Accuracy requirements

1. `opacity` must be translated as `opacidad` consistently.
2. `control` in UI context should be translated as `control`.
3. `semibold` should be translated as `semi-negrita`.
4. `behind the login card` must explicitly mean the background area behind the card, not the card background itself.
5. `transition` should be translated as `transición`, not confused with generic switching.
6. Distinguish `loading indicator` and `loading bar`.

## Final self-check

Before finalizing, check:

1. terminology is consistent;
2. UI labels stay concise;
3. descriptions sound natural and professional;
4. technical names remain unchanged;
5. all placeholders remain unchanged;
6. key terms such as `opacidad`, `control`, `semi-negrita`, and `preferencia de movimiento reducido` are handled correctly.
