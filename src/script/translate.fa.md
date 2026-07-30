# Translation guidance

You are translating luci-theme-fluent LuCI interface copy into Persian (`fa`).

Translation goals: keep the text concise, natural, and appropriate for a router/web UI while improving terminology accuracy, consistency, and professionalism. The result should read like polished OpenWrt / LuCI interface copy, not explanatory prose.

## Core rules

1. Use concise, professional, natural technical UI Persian.
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
8. If `luci-theme-fluent` appears as a package or project name, keep it unchanged. In natural descriptions of the theme itself, `پوسته Fluent` is acceptable.

## Terminology

Use these preferred translations consistently:

- theme → پوسته
- color mode → حالت رنگ
- light mode → حالت روشن
- dark mode → حالت تیره
- accent color → رنگ تأکیدی
- login page → صفحه ورود
- card → کارت
- login card → کارت ورود
- opacity → شفافیت
- transparent → شفاف
- opaque → مات
- blur → تاری
- blur radius → شعاع تاری
- backdrop → پس‌زمینه
- backdrop blur → تاری پس‌زمینه
- backdrop blur radius → شعاع تاری پس‌زمینه
- behind the login card → پشت کارت ورود
- navigation → ناوبری
- sidebar → نوار کناری
- tab → زبانه
- tab menu → منوی زبانه‌ها
- active underline → زیرخط فعال
- animation → انیمیشن
- transition → گذار
- page transition → گذار صفحه
- loading indicator → نشانگر بارگذاری
- loading bar → نوار بارگذاری
- top loading bar → نوار بارگذاری بالا
- toggle → تغییر وضعیت
- control → کنترل
- control height → ارتفاع کنترل‌ها
- input → ورودی
- select → انتخاب
- dropdown → فهرست کشویی
- font weight → ضخامت فونت
- semibold → نیمه‌پررنگ
- reduced-motion preference → ترجیح کاهش حرکت

## Style requirements

### Short labels

Keep short labels compact. Do not add unnecessary words like “تنظیمات”, “افکت”, or “رنگ”, unless omitting them would create ambiguity.

Recommended examples:

- Animation → انیمیشن
- Colors → رنگ‌ها
- General → عمومی
- Login page → صفحه ورود
- Theme settings → تنظیمات پوسته
- Control height → ارتفاع کنترل‌ها

### Mode-related settings

Use compact phrasing for light/dark mode settings.

Recommended examples:

- Dark mode accent color → رنگ تأکیدی حالت تیره
- Light mode accent color → رنگ تأکیدی حالت روشن
- Dark mode page background → پس‌زمینه صفحه در حالت تیره
- Light mode page background → پس‌زمینه صفحه در حالت روشن

### Action text

Keep action labels short and direct.

Recommended examples:

- Follow system → پیروی از سیستم
- Force dark mode → اجبار به حالت تیره
- Force light mode → اجبار به حالت روشن
- Toggle dark mode → تغییر حالت تیره
- Choose color → انتخاب رنگ
- Show top loading bar → نمایش نوار بارگذاری بالا

## Accuracy requirements

1. `opacity` must be translated as `شفافیت` consistently.
2. `control` in UI context should be translated as `کنترل`.
3. `semibold` should be translated as `نیمه‌پررنگ`.
4. `behind the login card` must explicitly mean the background area behind the card, not the card background itself.
5. `transition` should be translated as `گذار`, not confused with generic switching.
6. Distinguish `loading indicator` and `loading bar`.

## Final self-check

Before finalizing, check:

1. terminology is consistent;
2. UI labels stay concise;
3. descriptions sound natural and professional;
4. technical names remain unchanged;
5. all placeholders remain unchanged;
6. key terms such as `شفافیت`, `کنترل`, `نیمه‌پررنگ`, and `ترجیح کاهش حرکت` are handled correctly.
