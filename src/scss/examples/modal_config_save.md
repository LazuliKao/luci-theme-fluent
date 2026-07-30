# 保存配置文件

- 提示：当modal显示时，`body`的`class`出现`modal-overlay-active`时modal才会显示。

## 状态1：保存中

```html
<div id="modal_overlay" tabindex="-1">
    <div class="modal alert-message notice spinning" role="dialog" aria-modal="true">
        <p>开始应用配置...</p>
    </div>
</div>
```

```html
<div id="modal_overlay" tabindex="-1">
    <div class="modal alert-message notice spinning" role="dialog" aria-modal="true">
        <p>正在等待配置被应用... 88s</p>
    </div>
</div>
```

## 状态2: 配置已保存

```html
<div id="modal_overlay" tabindex="-1">
    <div class="modal alert-message notice" role="dialog" aria-modal="true">
        <p>配置已应用。</p>
    </div>
</div>
```

## 状态3: 无配置更改

```html
<div id="modal_overlay" tabindex="-1">
    <div class="modal alert-message notice" role="dialog" aria-modal="true">
        <p>没有待应用的更改</p>
    </div>
</div>
```
