# Translation guidance

You are translating luci-theme-fluent LuCI interface copy into Russian (`ru`).

Translation goals: keep the text concise, natural, and appropriate for a router/web UI while improving terminology accuracy, consistency, and professionalism. The result should read like polished OpenWrt / LuCI interface copy, not explanatory prose.

## Core rules

1. Use concise, professional, natural technical UI Russian.
2. Prefer short labels and short sentences.
3. Keep terminology consistent across the entire file.
4. Translate for UI context, not word-for-word.
5. Do not add information that is not present in the source.
6. Preserve product names, project names, and technical names:
   - LuCI stays `LuCI`
   - Fluent stays `Fluent`
   - FluentUI stays `FluentUI`
   - View Transition API stays `View Transition API`
7. Keep all variables, placeholders, and format specifiers unchanged, including `%s`, `%d`, and inline code.
8. If `luci-theme-fluent` appears as a package or project name, keep it unchanged. In natural descriptions of the theme itself, `тема Fluent` is acceptable.

## Terminology

Use these preferred translations consistently:

- theme → тема
- color mode → цветовой режим
- light mode → светлый режим
- dark mode → тёмный режим
- accent color → акцентный цвет
- login page → страница входа
- card → карточка
- login card → карточка входа
- opacity → непрозрачность
- transparent → прозрачный
- opaque → непрозрачный
- blur → размытие
- blur radius → радиус размытия
- backdrop → фон
- backdrop blur → размытие фона
- backdrop blur radius → радиус размытия фона
- behind the login card → за карточкой входа
- navigation → навигация
- sidebar → боковая панель
- tab → вкладка
- tab menu → меню вкладок
- active underline → активное подчёркивание
- animation → анимация
- transition → переход
- page transition → переход между страницами
- loading indicator → индикатор загрузки
- loading bar → полоса загрузки
- top loading bar → верхняя полоса загрузки
- toggle → переключатель
- control → элемент управления
- control height → высота элементов управления
- input → поле ввода
- select → список выбора
- dropdown → выпадающий список
- font weight → насыщенность шрифта
- semibold → полужирный
- reduced-motion preference → настройка уменьшения анимации

## Style requirements

### Short labels

Keep short labels compact. Do not add unnecessary words like “настройка”, “эффект”, or “цвет”, unless omitting them would create ambiguity.

Recommended examples:

- Animation → Анимация
- Colors → Цвета
- General → Общие
- Login page → Страница входа
- Theme settings → Настройки темы
- Control height → Высота элементов управления

### Mode-related settings

Use compact phrasing for light/dark mode settings. Avoid awkward constructions like “в режиме ... используется ...”, unless necessary for clarity.

Recommended examples:

- Dark mode accent color → Акцентный цвет тёмного режима
- Light mode accent color → Акцентный цвет светлого режима
- Dark mode page background → Фон страницы в тёмном режиме
- Light mode page background → Фон страницы в светлом режиме

### Action text

Keep action labels short and direct.

Recommended examples:

- Follow system → Следовать системе
- Force dark mode → Всегда тёмный режим
- Force light mode → Всегда светлый режим
- Toggle dark mode → Переключить тёмный режим
- Choose color → Выбрать цвет
- Show top loading bar → Показывать верхнюю полосу загрузки

## Accuracy requirements

1. `opacity` must be translated as `непрозрачность`, not `прозрачность`.
2. `control` in UI context should be translated as `элемент управления`, not the verb “управлять”.
3. `semibold` should be translated as `полужирный`, not just `жирный`.
4. `behind the login card` must explicitly mean the background area behind the card, not the card background itself.
5. `transition` should be translated as `переход`, not confused with generic switching.
6. Distinguish `loading indicator` and `loading bar`.

## Final self-check

Before finalizing, check:

1. terminology is consistent;
2. UI labels stay concise;
3. descriptions sound natural and professional;
4. technical names remain unchanged;
5. all placeholders remain unchanged;
6. key terms such as `непрозрачность`, `элемент управления`, `полужирный`, and `настройка уменьшения анимации` are handled correctly.
