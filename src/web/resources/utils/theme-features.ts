import {
  applyInlineGeometryToStyle,
  getEffectiveDocumentDirection,
  getInlinePadding,
  getRectInlineStart,
  getViewportInlineSize,
  type InlineGeometry,
} from "./direction";

declare global {
  interface Window {
    _fluent_last_tab_pos?: Record<string, { inlineStart: string; inlineSize: string; time: number }>;
  }
}

/**
 * Fluent Theme Features Initialization Module
 * Handles dark mode toggle, top loading bar behavior, sliding tab indicator,
 * and accessibility prefers-reduced-motion preferences.
 */
export function setupThemeFeatures() {
  const body = document.body;
  if (!body) return;
  const ui = L.ui;

  // ============================================================
  // PATCH: REDIRECT STRICT DIRECT-CHILD MODAL SELECTORS TO DESCENT-BASED SELECTORS
  //
  // Why: In LuCI core's form.js, the `getActiveModalMap()` method queries `.cbi-map` using a strict
  // child combinator: `body.modal-overlay-active > #modal_overlay > .modal.cbi-modal > .cbi-map:not(.hidden)`.
  // Because we wrap configuration map elements in a scroll container `.modal-content-wrap`,
  // the direct child query returns null, causing findClassInstance() to throw "Cannot read properties
  // of null (reading 'parentNode')" upon saving.
  //
  // LuCI upstream source code location:
  // https://github.com/openwrt/luci/blob/master/modules/luci-base/htdocs/luci-static/resources/form.js#L3742
  // ============================================================
  const originalQuerySelector = document.querySelector;
  (document as any).querySelector = function(selector: any) {
    if (typeof selector === 'string' && selector.includes('body.modal-overlay-active > #modal_overlay > .modal.cbi-modal > .cbi-map')) {
      const redirectedSelector = selector.replace('body.modal-overlay-active > #modal_overlay > .modal.cbi-modal > .cbi-map', 'body.modal-overlay-active > #modal_overlay > .modal.cbi-modal .cbi-map');
      // biome-ignore lint/style/noArguments: forward standard arguments list
      return originalQuerySelector.call(this, redirectedSelector);
    }
    // biome-ignore lint/style/noArguments: forward standard arguments list
    return originalQuerySelector.apply(this, arguments as any);
  };

  // ============================================================
  // PATCH: PREVENT EXTREMELY SHORT DROPDOWNS IN NESTED SCROLL PARENTS (E.G. TABS IN MODALS)
  // ============================================================
  // biome-ignore lint/suspicious/noExplicitAny: override core prototype without strict types
  const uiClass = (ui as any)?.Dropdown;
  if (uiClass?.prototype) {
    uiClass.prototype.getScrollParent = (element: HTMLElement) => {
      let parent: HTMLElement | null = element.parentElement;
      while (parent) {
        // Skip tab containers, sections, or elements with too small height that are not the actual scrollable modal body
        if (
          parent.classList.contains("cbi-tabcontainer") ||
          parent.id?.startsWith("container.") ||
          parent.classList.contains("cbi-section") ||
          (parent.clientHeight < 250 && !parent.classList.contains("modal"))
        ) {
          parent = parent.parentElement;
          continue;
        }

        const style = getComputedStyle(parent);
        if (/(auto|scroll)/.test(style.overflow + style.overflowY + style.overflowX)) {
          return parent;
        }

        parent = parent.parentElement;
      }
      return document.scrollingElement || document.documentElement;
    };
  }

  const callFluentSetMode = L.rpc.declare<{ result: number }, [string]>({ object: 'luci.fluent', method: 'set_mode', params: ['mode'] });
  // ============================================================
  // 1. ACCESSIBILITY: PREFERS REDUCED MOTION SETTINGS
  // ============================================================
  const prefersReducedMotionConfig = body.getAttribute('data-prefers-reduced-motion') || '1';
  
  function updateReducedMotionState() {
    if (prefersReducedMotionConfig === '1') {
      const systemReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      body.setAttribute('data-reduce-motion', systemReduced ? 'true' : 'false');
    } else {
      body.setAttribute('data-reduce-motion', 'false');
    }
  }

  updateReducedMotionState();

  if (prefersReducedMotionConfig === '1') {
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      body.setAttribute('data-reduce-motion', e.matches ? 'true' : 'false');
    });
  }

  // ============================================================
  // 2. DARK MODE TOGGLE BEHAVIOR
  // ============================================================
  const mode = body.getAttribute('data-theme-mode') || 'auto';
  const toggle = document.getElementById('theme-toggle') as HTMLButtonElement | null;

  /** Returns the effective visual theme for a given mode string */
  function getThemeForMode(modeType: string): string {
    if (modeType === 'dark') return 'dark';
    if (modeType === 'light') return 'light';
    // auto — follow system
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  /** Get current effective theme (what data-theme should be) */
  function getEffectiveTheme(): string {
    const currentMode = body.getAttribute('data-theme-mode') || 'auto';
    return getThemeForMode(currentMode);
  }

  /** Cycle: dark → light → auto → dark */
  function cycleMode(current: string): string {
    if (current === 'dark') return 'light';
    if (current === 'light') return 'auto';
    return 'dark';
  }

  /**
   * Visually indicates the effective theme based on current mode.
   * data-active-theme controls which icon is shown (sun/moon).
   * data-mode shows the mode type for styling.
   */
  function updateToggleState(activeTheme: string, modeType: string): void {
    if (!toggle) return;
    document.documentElement.setAttribute('data-theme', activeTheme);
    toggle.setAttribute('data-active-theme', activeTheme);
    toggle.setAttribute('data-mode', modeType);
  }

  if (toggle) {
    const effectiveTheme = getEffectiveTheme();
    updateToggleState(effectiveTheme, mode);
    toggle.hidden = false;

    // Smoothly fade-in theme toggle icon once DOM is fully interactive
    requestAnimationFrame(() => {
      toggle.classList.add('visible');
    });

    toggle.addEventListener('click', async () => {
      if (toggle.disabled) return;

      const currentMode = body.getAttribute('data-theme-mode') || mode;
      const nextMode = cycleMode(currentMode);
      const themeForMode = getThemeForMode(nextMode);

      toggle.disabled = true;
      updateToggleState(themeForMode, nextMode);

      try {
        const response = await callFluentSetMode(nextMode);

        if (response?.result !== 0) {
          throw new Error(`RPC returned ${response?.result ?? 'no response'} - permission denied or script error`);
        }

        body.setAttribute('data-theme-mode', nextMode);
      } catch (error) {
        // Rollback
        const rollbackMode = body.getAttribute('data-theme-mode') || mode;
        const rollbackTheme = getThemeForMode(rollbackMode);
        updateToggleState(rollbackTheme, rollbackMode);
        ui.addNotification(null, `Failed to save theme mode: ${error instanceof Error ? error.message : String(error)}`, 'error');
      } finally {
        toggle.disabled = false;
      }
    });

    // Listen for system preference changes (only relevant in 'auto' mode)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      const currentMode = body.getAttribute('data-theme-mode') || mode;
      if (currentMode !== 'auto') return;
      const targetTheme = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', targetTheme);
      toggle.setAttribute('data-active-theme', targetTheme);
    });
  }

  // ============================================================
  // 3. SLIDING TAB INDICATOR BEHAVIOR
  // ============================================================
  const tabAnimationEnabled = body.getAttribute('data-tab-animation') === '1';
  window._fluent_last_tab_pos = window._fluent_last_tab_pos || {};

  function getTabMenuKey(ul: HTMLElement): string {
    if (ul.classList.contains('tabs')) {
      return 'header-tabs';
    }
    const section = ul.closest('.cbi-section');
    if (section?.id) {
      return `cbi-tabs-${section.id}`;
    }
    return 'cbi-tabs-generic';
  }

  function updateSlider(ul: HTMLElement) {
    const rectUl = ul.getBoundingClientRect();
    if (rectUl.width === 0 && rectUl.height === 0) {
      return;
    }

    let slider = ul.querySelector('.fluent-tab-slider') as HTMLElement | null;
    if (!slider) {
      slider = document.createElement('div');
      slider.className = 'fluent-tab-slider';
      ul.appendChild(slider);
    }
    
    const activeLi = ul.querySelector('li.cbi-tab, li.active') as HTMLElement | null;
    if (!activeLi) {
      slider.style.width = '0px';
      return;
    }
    
    const activeA = activeLi.querySelector('a') as HTMLElement | null;
    if (!activeA) return;
    
    const rectA = activeA.getBoundingClientRect();

    const style = window.getComputedStyle(activeA);
    const direction = getEffectiveDocumentDirection();
    const viewportInlineSize = getViewportInlineSize();
    const inlinePadding = getInlinePadding(style);
    const rectInlineStart = getRectInlineStart(rectA, direction, viewportInlineSize);
    const containerInlineStart = getRectInlineStart(rectUl, direction, viewportInlineSize);
    const scrollLeft = Math.abs(ul.scrollLeft);
    const inlineGeometry: InlineGeometry = {
      inlineStart: rectInlineStart - containerInlineStart + scrollLeft + inlinePadding.inlineStart,
      inlineSize: rectA.width - inlinePadding.inlineStart - inlinePadding.inlineEnd,
    };
    const newInlineStartStr = `${inlineGeometry.inlineStart}px`;
    const newInlineSizeStr = `${inlineGeometry.inlineSize}px`;

    // Avoid interrupting active transitions if values are unchanged
    if (
      slider.dataset.inlineStart === newInlineStartStr
      && slider.dataset.inlineSize === newInlineSizeStr
    ) {
      return;
    }
    
    const key = getTabMenuKey(ul);
    const lastPos = window._fluent_last_tab_pos?.[key];
    const hasInlineStart = slider.dataset.inlineStart !== undefined;

    if (!hasInlineStart && lastPos && (Date.now() - lastPos.time < 2000)) {
      slider.style.transition = 'none';
      applyInlineGeometryToStyle(
        slider.style,
        {
          inlineStart: Number.parseFloat(lastPos.inlineStart),
          inlineSize: Number.parseFloat(lastPos.inlineSize),
        },
      );
      slider.dataset.inlineStart = lastPos.inlineStart;
      slider.dataset.inlineSize = lastPos.inlineSize;
      slider.offsetHeight; // force reflow
      slider.style.transition = '';
    }

    applyInlineGeometryToStyle(slider.style, inlineGeometry);
    slider.dataset.inlineStart = newInlineStartStr;
    slider.dataset.inlineSize = newInlineSizeStr;

    if (window._fluent_last_tab_pos) {
      window._fluent_last_tab_pos[key] = {
        inlineStart: newInlineStartStr,
        inlineSize: newInlineSizeStr,
        time: Date.now()
      };
    }
  }

  function initTabs() {
    const tabLists = document.querySelectorAll('ul.cbi-tabmenu, ul.tabs');
    tabLists.forEach((node) => {
      const ul = node as HTMLElement;
      if (ul.dataset.sliderInit) {
        updateSlider(ul);
        return;
      }
      ul.dataset.sliderInit = 'true';
      
      let slider = ul.querySelector('.fluent-tab-slider') as HTMLElement | null;
      if (!slider) {
        slider = document.createElement('div');
        slider.className = 'fluent-tab-slider';
        ul.appendChild(slider);
      }

      if (tabAnimationEnabled && ul.classList.contains('tabs')) {
        let saved: string | null = null;
        try {
          saved = sessionStorage.getItem('fluent-tab-slider-pos');
        } catch {}
        
        if (saved) {
          try {
            const pos = JSON.parse(saved);
            sessionStorage.removeItem('fluent-tab-slider-pos');
            
            slider.style.transition = 'none';
            applyInlineGeometryToStyle(
              slider.style,
              {
                inlineStart: Number.parseFloat(pos.inlineStart),
                inlineSize: Number.parseFloat(pos.inlineSize),
              },
            );
            slider.dataset.inlineStart = pos.inlineStart;
            slider.dataset.inlineSize = pos.inlineSize;
            slider.offsetHeight; // force reflow
            
            slider.style.transition = '';
            updateSlider(ul);
          } catch {
            updateSlider(ul);
          }
        } else {
          updateSlider(ul);
          const direction = getEffectiveDocumentDirection();
          slider.style.transition = 'none';
          slider.style.transformOrigin = direction === 'rtl' ? 'right center' : 'left center';
          slider.style.transform = 'scaleX(0)';
          slider.offsetHeight; // force reflow
          slider.style.transition = '';
          slider.style.transform = 'scaleX(1)';
        }

        ul.querySelectorAll('li > a').forEach((el) => {
          const a = el as HTMLAnchorElement;
          const href = a.getAttribute('href');
          if (href && href !== '#') {
            a.addEventListener('click', () => {
              try {
                if (slider) {
                  sessionStorage.setItem('fluent-tab-slider-pos', JSON.stringify({
                    inlineStart: slider.dataset.inlineStart || '0px',
                    inlineSize: slider.dataset.inlineSize || '0px'
                  }));
                }
              } catch {}
            });
          }
        });
      } else {
        updateSlider(ul);
      }
      
      const observer = new MutationObserver(() => {
        updateSlider(ul);
      });
      observer.observe(ul, { attributes: true, subtree: true, attributeFilter: ['class'] });

      try {
        const visibilityObserver = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              updateSlider(ul);
            }
          }
        }, { threshold: 0 });
        visibilityObserver.observe(ul);
      } catch (e) {
        console.warn('Fluent theme: IntersectionObserver not supported', e);
      }
    });
  }

  function initModals() {
    const modals = document.querySelectorAll('#modal_overlay .modal');
    modals.forEach((node) => {
      const modal = node as HTMLElement;
      
      let wrap = modal.querySelector('.modal-content-wrap') as HTMLElement | null;
      const children = Array.from(modal.children);
      
      // Filter out close buttons and script/style elements
      const layoutChildren = children.filter((child) => {
        if (child === wrap) return false;
        const isClose = child.classList.contains('close') || child.classList.contains('modal-close');
        const isMeta = child.tagName === 'SCRIPT' || child.tagName === 'STYLE';
        return !isClose && !isMeta;
      });

      if (layoutChildren.length === 0) return;

      // 1. Identify header elements at the beginning
      const headers: Element[] = [];
      let i = 0;
      while (i < layoutChildren.length) {
        const child = layoutChildren[i];
        const isHeader = child.tagName === 'H4' || 
                         child.classList.contains('modal-header') || 
                         child.classList.contains('cbi-tabmenu') || 
                         child.classList.contains('tabs');
        if (isHeader) {
          headers.push(child);
          i++;
        } else {
          break;
        }
      }

      // 2. Identify the footer at the end (if it contains buttons or matches footer classes)
      let footerStartElement: Element | null = null;
      if (i < layoutChildren.length) {
        const lastChild = layoutChildren[layoutChildren.length - 1];
        if (!headers.includes(lastChild)) {
          const isFooterClass = lastChild.classList.contains('button-row') || 
                                lastChild.classList.contains('modal-footer') || 
                                lastChild.classList.contains('right');
          const hasButtons = lastChild.querySelector('button, .btn, .cbi-button, input[type="button"], input[type="submit"]') !== null;
          
          if (isFooterClass || hasButtons) {
            footerStartElement = lastChild;

            // Check if the second-to-last child contains a checkbox, and group it into the footer block
            if (layoutChildren.length >= 3) {
              const secondLastChild = layoutChildren[layoutChildren.length - 2];
              if (!headers.includes(secondLastChild)) {
                const isMainContent = secondLastChild.classList.contains('cbi-map') || 
                                      secondLastChild.classList.contains('cbi-section') || 
                                      secondLastChild.tagName === 'UL' || 
                                      secondLastChild.tagName === 'TABLE' ||
                                      secondLastChild.id.startsWith('cbi-');
                
                if (!isMainContent) {
                  const hasCheckbox = secondLastChild.querySelector('input[type="checkbox"], .cbi-checkbox') !== null;
                  const hasOtherInputs = secondLastChild.querySelector('input[type="text"], input[type="number"], input[type="password"], textarea, select') !== null;
                  
                  if (hasCheckbox && !hasOtherInputs) {
                    footerStartElement = secondLastChild;
                  }
                }
              }
            }
          }
        }
      }

      // 3. Elements between headers and footerStartElement are the scrollable content
      const contentChildren: Element[] = [];
      const contentEndIndex = footerStartElement ? layoutChildren.indexOf(footerStartElement) : layoutChildren.length;
      for (let j = i; j < contentEndIndex; j++) {
        contentChildren.push(layoutChildren[j]);
      }

      if (contentChildren.length > 0) {
        if (!wrap) {
          wrap = document.createElement('div');
          wrap.className = 'modal-content-wrap';
          
          if (footerStartElement) {
            modal.insertBefore(wrap, footerStartElement);
          } else {
            modal.appendChild(wrap);
          }
        }

        for (const child of contentChildren) {
          wrap.appendChild(child);
        }
      }
    });
  }

  // Initialize tabs, modals & observe changes
  initTabs();
  initModals();
  const bodyObserver = new MutationObserver(() => {
    initTabs();
    initModals();
  });
  bodyObserver.observe(body, { childList: true, subtree: true });

  window.addEventListener('resize', () => {
    document.querySelectorAll('ul.cbi-tabmenu, ul.tabs').forEach((node) => {
      updateSlider(node as HTMLElement);
    });
  });

  // ============================================================
  // 4. TOP LOADING BAR BEHAVIOR
  // ============================================================
  const loadingBarEnabled = body.getAttribute('data-loading-bar') === '1';
  if (loadingBarEnabled) {
    let isUnloading = false;
    const loader = document.getElementById('fluent-top-loading');

    const hideLoading = () => {
      if (loader && !isUnloading) {
        loader.classList.add('loaded');
      }
    };

    const showLoading = () => {
      if (loader) {
        loader.classList.remove('loaded');
      }
    };

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      hideLoading();
    } else {
      document.addEventListener('DOMContentLoaded', hideLoading);
    }

    window.addEventListener('load', hideLoading);
    window.addEventListener('beforeunload', () => {
      isUnloading = true;
      showLoading();
    });

    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const a = target.closest('a');
      if (a) {
        const href = a.getAttribute('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !a.getAttribute('target')) {
          if (a.hostname === location.hostname) {
            showLoading();
          }
        }
      }
    });

    document.addEventListener('submit', (e) => {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const form = target.closest('form');
      if (form && !form.getAttribute('target')) {
        showLoading();
      }
    });

    const ajaxObserver = new MutationObserver(() => {
      const hasSpinner = Array.from(document.querySelectorAll('.spinning, .loading, #view > .spinning')).some((node) => {
        const element = node as HTMLElement;
        const style = window.getComputedStyle(element);
        const isVisible = element.getClientRects().length > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        return isVisible && !element.closest('.btn');
      });

      if (hasSpinner) {
        showLoading();
      } else {
        hideLoading();
      }
    });
    ajaxObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  // ============================================================
  // 5. SLIDING SIDEBAR INDICATOR BEHAVIOR
  // ============================================================
  function updateSidebarSlider(ul: HTMLElement, isParent: boolean) {
    const sliderClass = isParent ? 'fluent-sidebar-parent-slider' : 'fluent-sidebar-slider';
    let slider = ul.querySelector(`.${sliderClass}`) as HTMLElement | null;
    if (!slider) {
      slider = document.createElement('div');
      slider.className = sliderClass;
      ul.appendChild(slider);
    }

    const activeLi = ul.querySelector('li.active') as HTMLElement | null;
    if (!activeLi || (isParent && (activeLi.classList.contains('slide') || activeLi.querySelector('.slide-menu')))) {
      slider.style.height = '0px';
      slider.style.opacity = '0';
      return;
    }
    slider.style.opacity = '1';

    const targetEl = isParent 
      ? (activeLi.querySelector('a.menu, a.food') as HTMLElement | null)
      : (activeLi as HTMLElement | null);
      
    if (!targetEl) return;

    const rectTarget = targetEl.getBoundingClientRect();
    const rectUl = ul.getBoundingClientRect();

    let top: number;
    let height: number;

    if (isParent) {
      top = rectTarget.top - rectUl.top + ul.scrollTop + rectTarget.height * 0.2;
      height = rectTarget.height * 0.6;
    } else {
      top = rectTarget.top - rectUl.top + ul.scrollTop + rectTarget.height * 0.15;
      height = rectTarget.height * 0.7;
    }

    slider.style.top = `${top}px`;
    slider.style.height = `${height}px`;
  }

  function initSidebarSliders() {
    const sidebar = document.querySelector('#mainmenu') as HTMLElement | null;
    if (!sidebar) return;

    // 1. Parent Menu Slider (ul.nav)
    const navUl = sidebar.querySelector('ul.nav') as HTMLElement | null;
    if (navUl) {
      let slider = navUl.querySelector('.fluent-sidebar-parent-slider') as HTMLElement | null;
      if (!slider) {
        slider = document.createElement('div');
        slider.className = 'fluent-sidebar-parent-slider';
        navUl.appendChild(slider);
      }
      navUl.classList.add('has-slider');

      if (!navUl.dataset.sliderInit) {
        navUl.dataset.sliderInit = 'true';

        if (tabAnimationEnabled) {
          navUl.querySelectorAll('li > a.menu, li > a.food').forEach((el) => {
            const a = el as HTMLAnchorElement;
            const href = a.getAttribute('href');
            if (href && href !== '#') {
              a.addEventListener('click', () => {
                try {
                  const currentSlider = navUl.querySelector('.fluent-sidebar-parent-slider') as HTMLElement | null;
                  if (currentSlider) {
                    sessionStorage.setItem('fluent-sidebar-parent-pos', JSON.stringify({
                      top: currentSlider.style.top,
                      height: currentSlider.style.height
                    }));
                  }
                } catch {}
              });
            }
          });
        }
      }

      if (tabAnimationEnabled) {
        let saved: string | null = null;
        try { saved = sessionStorage.getItem('fluent-sidebar-parent-pos'); } catch {}
        if (saved) {
          try {
            const pos = JSON.parse(saved);
            sessionStorage.removeItem('fluent-sidebar-parent-pos');
            slider.style.transition = 'none';
            slider.style.top = pos.top;
            slider.style.height = pos.height;
            slider.offsetHeight; // force reflow
            slider.style.transition = '';
          } catch {}
        }
      }

      updateSidebarSlider(navUl, true);
    }

    // 2. Submenu Sliders (ul.slide-menu)
    const submenuLists = sidebar.querySelectorAll('ul.slide-menu');
    submenuLists.forEach((node) => {
      const ul = node as HTMLElement;
      const isActiveSubmenu = ul.classList.contains('active');

      let slider = ul.querySelector('.fluent-sidebar-slider') as HTMLElement | null;
      if (!slider) {
        slider = document.createElement('div');
        slider.className = 'fluent-sidebar-slider';
        ul.appendChild(slider);
      }
      ul.classList.add('has-slider');

      if (!ul.dataset.sliderInit) {
        ul.dataset.sliderInit = 'true';

        if (tabAnimationEnabled) {
          ul.querySelectorAll('li > a').forEach((el) => {
            const a = el as HTMLAnchorElement;
            const href = a.getAttribute('href');
            if (href && href !== '#') {
              a.addEventListener('click', () => {
                try {
                  const currentSlider = ul.querySelector('.fluent-sidebar-slider') as HTMLElement | null;
                  if (currentSlider) {
                    sessionStorage.setItem('fluent-sidebar-submenu-pos', JSON.stringify({
                      top: currentSlider.style.top,
                      height: currentSlider.style.height
                    }));
                  }
                } catch {}
              });
            }
          });
        }
      }

      if (tabAnimationEnabled && isActiveSubmenu) {
        let saved: string | null = null;
        try { saved = sessionStorage.getItem('fluent-sidebar-submenu-pos'); } catch {}
        if (saved) {
          try {
            const pos = JSON.parse(saved);
            sessionStorage.removeItem('fluent-sidebar-submenu-pos');
            slider.style.transition = 'none';
            slider.style.top = pos.top;
            slider.style.height = pos.height;
            slider.offsetHeight; // force reflow
            slider.style.transition = '';
          } catch {}
        }
      }

      updateSidebarSlider(ul, false);
    });
  }

  // Initialize sidebar sliders
  initSidebarSliders();
  
  // Watch for dynamic rendering of menu in LuCI
  const sidebarObserver = new MutationObserver(() => initSidebarSliders());
  sidebarObserver.observe(body, { childList: true, subtree: true });

  // Listen to menu expand/collapse events to update the parent slider
  document.addEventListener('fluent-menu-expand', () => {
    const sidebar = document.querySelector('#mainmenu') as HTMLElement | null;
    if (sidebar) {
      const navUl = sidebar.querySelector('ul.nav') as HTMLElement | null;
      if (navUl) {
        updateSidebarSlider(navUl, true);
        setTimeout(() => {
          updateSidebarSlider(navUl, true);
        }, 250);
      }
    }
  });
  document.addEventListener('fluent-sidebar-state-change', () => {
    const sidebar = document.querySelector('#mainmenu') as HTMLElement | null;

    if (sidebar) {
      const navUl = sidebar.querySelector('ul.nav') as HTMLElement | null;
      if (navUl) updateSidebarSlider(navUl, true);
      sidebar.querySelectorAll('ul.slide-menu').forEach((node) => {
        updateSidebarSlider(node as HTMLElement, false);
      });
    }
  });

  window.addEventListener('resize', () => {
    const sidebar = document.querySelector('#mainmenu') as HTMLElement | null;
    if (sidebar) {
      const navUl = sidebar.querySelector('ul.nav') as HTMLElement | null;
      if (navUl) updateSidebarSlider(navUl, true);
      sidebar.querySelectorAll('ul.slide-menu').forEach((node) => {
        updateSidebarSlider(node as HTMLElement, false);
      });
    }
  });
}
