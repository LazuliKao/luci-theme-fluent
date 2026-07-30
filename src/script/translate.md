# 翻译额外信息

你正在翻译 luci-theme-fluent 的 LuCI 界面文案，目标语言为简体中文。

翻译目标：在保持简洁、自然、适合 UI 的风格基础上，提高术语准确性、一致性和专业度。译文应像正式 OpenWrt / LuCI 设置界面中的中文文案，而不是解释性说明文。

## 核心原则

1. 使用简洁、专业、自然的技术 UI 中文。
2. 优先使用短句，避免冗长解释。
3. 保持术语一致，同一英文术语在全文中应使用同一中文译法。
4. 不要逐字硬译，应根据设置界面语境翻译成自然中文。
5. 不要添加原文没有的信息。
6. 使用中文标点。
7. 保留产品名、项目名和技术名：
   - LuCI 不翻译
   - Fluent 不翻译
   - FluentUI 不翻译
   - View Transition API 不翻译
8. `luci-theme-fluent` 如果作为包名或项目名出现，保留原文；如果是在自然描述中指主题本身，可译为“Fluent 主题”。
9. 保留所有变量、占位符和格式符，例如 `%s`，不得改动、遗漏或翻译。
10. 中文与英文、数字之间适当留空格，例如：
    - Fluent 主题
    - LuCI 页面
    - 0 表示完全透明
    - 1 表示完全不透明

## 术语表

请严格遵循以下术语：

- luci-theme-fluent：Fluent 主题；作为包名或项目名时保留 `luci-theme-fluent`
- FluentUI：FluentUI
- Fluent：Fluent
- LuCI：LuCI
- theme：主题
- color mode：色彩模式
- light mode：亮色模式
- dark mode：深色模式
- accent color：强调色
- login page：登录页
- card：卡片
- login card：登录卡片
- opacity：不透明度
- transparent：透明
- opaque：不透明
- blur：模糊
- blur radius：模糊半径
- backdrop：背景
- backdrop blur：背景模糊
- backdrop blur radius：背景模糊半径
- behind the login card：登录卡片背后
- navigation：导航
- sidebar：侧边栏
- navigation sidebar：导航侧边栏
- tab：标签页
- tab menu：标签菜单
- active underline：活动下划线
- animation：动画
- transition：过渡
- page transition：页面过渡
- loading indicator：加载指示器
- loading bar：加载条
- top loading bar：顶部加载条
- toggle：切换
- notification：通知
- interval：间隔
- debounce：防抖
- control：控件
- control height：控件高度
- form control：表单控件
- input：输入框
- select：选择框
- dropdown：下拉菜单
- custom dropdown widget：自定义下拉组件
- font weight：字体粗细
- semibold：半粗体
- reduced-motion preference：减少动态效果偏好设置

## 风格要求

### 短标签

短标签应尽量简洁，不要加不必要的“设置”“效果”“颜色”等后缀，除非不加会造成歧义。

推荐：

- Animation → 动画
- Colors → 颜色
- General → 常规
- Login page → 登录页
- Theme settings → 主题设置
- Control height → 控件高度
- Navigation font weight → 导航字体粗细
- Normal → 常规
- Semibold → 半粗体

不推荐：

- Animation → 动画效果
- Colors → 颜色设置
- General → 通用设置
- Control height → 控制高度
- Semibold → 粗体

### 模式类设置项

模式类设置项使用紧凑表达，不必机械翻译成“在......下的......”。

推荐：

- Dark mode accent color → 深色模式强调色
- Light mode accent color → 亮色模式强调色
- Dark mode page background → 深色模式页面背景
- Light mode page background → 亮色模式页面背景
- Dark mode sidebar background → 深色模式侧边栏背景
- Light mode sidebar background → 亮色模式侧边栏背景
- Dark mode login card opacity → 深色模式登录卡片不透明度
- Light mode login card opacity → 亮色模式登录卡片不透明度
- Dark mode backdrop blur radius → 深色模式背景模糊半径
- Light mode backdrop blur radius → 亮色模式背景模糊半径

### 动作类文案

动作类文案保持简洁，避免过度解释。

推荐：

- Follow system → 跟随系统
- Force dark mode → 强制深色模式
- Force light mode → 强制亮色模式
- Toggle dark mode → 切换深色模式
- Choose color → 选择颜色
- Show top loading bar → 显示顶部加载条
- Enable page transition animation → 启用页面过渡动画
- Enable tab underline animation → 启用标签页下划线动画
- Use Fluent custom select dropdowns → 使用 Fluent 自定义下拉选择框

## 关键准确性要求

### opacity 必须译为“不透明度”

`opacity` 表示不透明度，不要译为“透明度”。

推荐：

- 深色模式登录卡片不透明度
- 亮色模式登录卡片不透明度
- 深色模式下登录卡片的不透明度。0 表示完全透明，1 表示完全不透明。
- 亮色模式下登录卡片的不透明度。0 表示完全透明，1 表示完全不透明。

不推荐：

- 登录卡片透明度
- 透明度。0 表示完全透明，1 表示完全不透明。

### control 在 UI 语境中译为“控件”

`control` 在界面设置中通常指控件，不是动词“控制”。

推荐：

- Control height → 控件高度
- core controls → 核心控件
- form controls → 表单控件

不推荐：

- 控制高度
- 控制项高度

### semibold 译为“半粗体”

`semibold` 不是普通“粗体”。

推荐：

- Semibold → 半粗体

不推荐：

- 粗体

### behind the login card 应译出“背后”

`behind the login card` 表示登录卡片后方的背景区域，不是登录卡片自身背景。

推荐：

- 深色模式下登录卡片背后的背景模糊半径，单位为像素。使用 0 可禁用模糊效果。
- 亮色模式下登录卡片背后的背景模糊半径，单位为像素。使用 0 可禁用模糊效果。

不推荐：

- 登录卡片背景的模糊半径

### reduced-motion preference 统一为“减少动态效果偏好设置”

该术语应保持一致。

推荐：

- 遵循减少动态效果偏好设置
- 启用后，Fluent 动画将遵循浏览器或操作系统的减少动态效果偏好设置。

不推荐：

- 尊重减少动画的偏好设置
- 低动作模式设置
- 减少运动偏好设置

### transition 译为“过渡”

`transition` 在页面动画语境中译为“过渡”，不要与普通“切换”混用。

推荐：

- page transition → 页面过渡
- page transitions → 页面过渡
- transitions → 过渡

但如果原文是 `switching between tabs`，应译为“切换标签页”。

### loading indicator 和 loading bar 区分处理

- loading indicator → 加载指示器
- loading bar → 加载条
- top loading bar → 顶部加载条

## 推荐表达

请优先使用以下风格的表达：

- 分别调整亮色模式和深色模式下登录卡片的不透明度与模糊效果。
- 在切换原生 LuCI 标签页和主题化标签菜单时，为活动下划线添加动画。
- 适用于整个主题中的标准按钮、输入框、选择框及类似表单控件。
- 选择主题的显示模式，以及核心控件的显示尺寸。
- 配置 Fluent 主题的色彩模式、强调色、动画行为和登录页外观。
- 控制页面过渡、标签下划线动画和顶部加载指示器。
- 控制主导航标签及相关主题强调文本的字体粗细。
- 在页面加载和过渡期间，在顶部边缘显示主题化加载指示器。
- 在浏览器支持时，使用 View Transition API 为 LuCI 页面导航添加过渡动画。
- 使用系统/浏览器偏好设置，或始终以固定的亮色或深色配色渲染 Fluent 主题。

## 不推荐表达

请避免以下问题：

1. 不要把 `opacity` 译为“透明度”。
2. 不要把 `Control height` 译为“控制高度”。
3. 不要把 `Semibold` 译为“粗体”。
4. 不要把 `behind the login card` 译成“登录卡片背景”。
5. 不要出现“选择主题如何选择其模式”这类重复表达。
6. 不要把 `reduced-motion preference` 译得前后不一致。
7. 不要把 UI 短标签翻译得过长。
8. 不要把 `transition` 和 `switching` 全部混译成“切换”。
9. 不要遗漏或修改 `%s` 等占位符。
10. 不要随意翻译 LuCI、Fluent、FluentUI、View Transition API。

## 标点和格式

1. 使用中文标点。
2. 中文括号优先用于中文译文：
   - 舒适（42px）
   - 紧凑（32px）
3. 数字和中文之间留空格：
   - 0 表示完全透明
   - 1 表示完全不透明
4. 英文技术名和中文之间留空格：
   - Fluent 主题
   - LuCI 页面
   - View Transition API
5. 保留尺寸单位原文形式：
   - 42px
   - 32px
6. 校验提示中的 `HEX color value` 推荐译为“有效的十六进制颜色值”。

## 最终自检

翻译完成后，请检查：

1. 术语是否前后一致。
2. UI 标签是否简洁。
3. 说明句是否自然、专业。
4. 是否保留所有英文技术名。
5. 是否保留所有占位符。
6. 是否正确处理“不透明度”“控件”“半粗体”“背景模糊”“减少动态效果偏好设置”等关键术语。
7. 是否避免英文腔和机械直译。
