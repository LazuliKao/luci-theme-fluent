#!/usr/bin/env python3
import os
import re
import argparse

LANG_MAP = {
    'de': 'German (Deutsch)',
    'es': 'Spanish (Español)',
    'fa': 'Persian (فارسی)',
    'fr': 'French (Français)',
    'it': 'Italian (Italiano)',
    'ja': 'Japanese (日本語)',
    'ko': 'Korean (한국어)',
    'pl': 'Polish (Polski)',
    'ru': 'Russian (Русский)',
    'tr': 'Turkish (Türkçe)',
    'uk': 'Ukrainian (Ukraïns\'ka)',
    'vi': 'Vietnamese (Tiếng Việt)',
    'zh-cn': 'Simplified Chinese (简体中文)',
    'zh-hans': 'Simplified Chinese (简体中文)',
    'zh_hans': 'Simplified Chinese (简体中文)',
    'zh-tw': 'Traditional Chinese (繁體中文)',
    'zh-hant': 'Traditional Chinese (繁體中文)',
    'zh_hant': 'Traditional Chinese (繁體中文)'
}

def get_lang_name(code):
    return LANG_MAP.get(code.lower(), f"Unknown ({code})")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--tag', required=True)
    parser.add_argument('--repo', required=True)
    parser.add_argument('--version', required=True)
    parser.add_argument('--commit', required=True)
    parser.add_argument('--dir', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--is-nightly', action='store_true')
    args = parser.parse_args()

    if not os.path.exists(args.dir):
        print(f"Directory {args.dir} does not exist.")
        return

    files = os.listdir(args.dir)
    
    themes = {
        'full': {'package': 'luci-theme-fluent', 'ipk': None, 'apk': None},
        'lite': {'package': 'luci-theme-fluent-lite', 'ipk': None, 'apk': None},
    }
    i18n_data = {}  # lang_code -> {'ipk': filename, 'apk': filename}

    for f in files:
        if f.startswith('luci-theme-fluent-lite_') or f.startswith('luci-theme-fluent-lite-'):
            if f.endswith('.ipk'):
                themes['lite']['ipk'] = f
            elif f.endswith('.apk'):
                themes['lite']['apk'] = f
        elif f.startswith('luci-theme-fluent_') or f.startswith('luci-theme-fluent-'):
            if f.endswith('.ipk'):
                themes['full']['ipk'] = f
            elif f.endswith('.apk'):
                themes['full']['apk'] = f
        elif f.startswith('luci-i18n-fluent'):
            # Match ipk (e.g. luci-i18n-fluent-zh-hans_1.0.6-1_all.ipk)
            ipk_match = re.match(r'^luci-i18n-fluent-([a-zA-Z_-]+)_(.+)_all\.ipk$', f)
            if ipk_match:
                lang = ipk_match.group(1).lower()
                if lang not in i18n_data:
                    i18n_data[lang] = {}
                i18n_data[lang]['ipk'] = f
                continue
            
            # Match apk (e.g. luci-i18n-fluent-zh-hans-1.0.6-r1.apk)
            apk_match = re.match(r'^luci-i18n-fluent-([a-zA-Z_-]+)-([0-9].*)\.apk$', f)
            if apk_match:
                lang = apk_match.group(1).lower()
                if lang not in i18n_data:
                    i18n_data[lang] = {}
                i18n_data[lang]['apk'] = f
                continue

    # Generate markdown
    md = []
    
    if args.is_nightly:
        md.append("## LuCI Theme Fluent - Nightly Build\n")
        md.append(f"Automatic build for package version `{args.version}` from commit `{args.commit}`.\n")
    else:
        md.append(f"## LuCI Theme Fluent {args.tag}\n")

    md.append("### Packages")
    md.append("- `luci-theme-fluent` — Full FluentUI theme for OpenWrt LuCI")
    md.append("- `luci-theme-fluent-lite` — Core FluentUI theme without optional enhancements (mutually exclusive with full)")
    md.append("- `luci-i18n-fluent` — Translations\n")

    # Add Downloads Section
    md.append("### Downloads\n")
    md.append("#### Core Packages")
    md.append("| Platform / Format | Package Name | Direct Download |")
    md.append("| --- | --- | :---: |")
    
    base_url = f"https://github.com/{args.repo}/releases/download/{args.tag}"
    
    for variant in ('full', 'lite'):
        package = themes[variant]['package']
        label = 'Full' if variant == 'full' else 'Lite'
        ipk = themes[variant]['ipk']
        apk = themes[variant]['apk']
        ipk_link = f"[Download (ipk)]({base_url}/{ipk})" if ipk else "-"
        apk_link = f"[Download (apk)]({base_url}/{apk})" if apk else "-"
        md.append(f"| **OpenWrt 24.10.x (ipk)** | `{package}` ({label}) | {ipk_link} |")
        md.append(f"| **OpenWrt 25.12.x (apk)** | `{package}` ({label}) | {apk_link} |")
        
    md.append("\n")

    if i18n_data:
        md.append("#### Language Packs")
        md.append("<details>")
        md.append("<summary>Click to expand / collapse translation packages</summary>\n")
        md.append("| Language | OpenWrt 24.10.x (ipk) | OpenWrt 25.12.x (apk) |")
        md.append("| --- | :---: | :---: |")
        
        # Sort languages by name or code
        for lang_code in sorted(i18n_data.keys()):
            lang_name = get_lang_name(lang_code)
            data = i18n_data[lang_code]
            ipk_link = f"[Download]({base_url}/{data['ipk']})" if 'ipk' in data else "-"
            apk_link = f"[Download]({base_url}/{data['apk']})" if 'apk' in data else "-"
            md.append(f"| **{lang_name}** | {ipk_link} | {apk_link} |")
            
        md.append("\n</details>\n")

    # Add Installation Section
    md.append("### Installation\n")
    md.append("**OpenWrt 24.10.x (opkg/ipk):**")
    md.append("```bash")
    md.append("opkg install luci-theme-fluent_*.ipk  # Full (default)")
    md.append("opkg install luci-theme-fluent-lite_*.ipk  # Lite")
    md.append("```\n")
    md.append("**OpenWrt 25.12.x (apk):**")
    md.append("```bash")
    md.append("apk add luci-theme-fluent-*.apk  # Full (default)")
    md.append("apk add luci-theme-fluent-lite-*.apk  # Lite")
    md.append("```")
    md.append("\nInstall only one variant at a time.")

    with open(args.output, 'w', encoding='utf-8') as f:
        f.write('\n'.join(md))
    print(f"Release notes written to {args.output}")

if __name__ == '__main__':
    main()
