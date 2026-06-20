declare global {
  interface Window {
    _fluent_last_tab_pos?: Record<string, { left: string; width: string; time: number }>;
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
  const mode = body.getAttribute('data-theme-mode') || 'normal';
  const toggle = document.getElementById('theme-toggle');
  
  if (toggle) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    toggle.setAttribute('data-active-theme', isDark ? 'dark' : 'light');
    
    // Smoothly fade-in theme toggle icon once DOM is fully interactive
    requestAnimationFrame(() => {
      toggle.classList.add('visible');
    });

    // Theme toggle click handler
    toggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const newTheme = current === 'dark' ? 'light' : 'dark';
      
      document.documentElement.setAttribute('data-theme', newTheme);
      toggle.setAttribute('data-active-theme', newTheme);
      
      try {
        localStorage.setItem('fluent-theme', newTheme);
      } catch {}
    });

    // System dark mode listener (active only when theme mode is set to 'normal')
    if (mode === 'normal') {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        try {
          if (localStorage.getItem('fluent-theme')) return;
        } catch {}
        const dark = e.matches;
        const targetTheme = dark ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', targetTheme);
        toggle.setAttribute('data-active-theme', targetTheme);
      });
    }
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
    const rectUl = ul.getBoundingClientRect();
    
    const style = window.getComputedStyle(activeA);
    const paddingLeft = parseFloat(style.paddingLeft) || 16;
    const paddingRight = parseFloat(style.paddingRight) || 16;
    
    const left = rectA.left - rectUl.left + ul.scrollLeft + paddingLeft;
    const width = rectA.width - paddingLeft - paddingRight;
    
    const newLeftStr = `${left}px`;
    const newWidthStr = `${width}px`;

    // Avoid interrupting active transitions if values are unchanged
    if (slider.style.left === newLeftStr && slider.style.width === newWidthStr) {
      return;
    }
    
    const key = getTabMenuKey(ul);
    const lastPos = window._fluent_last_tab_pos?.[key];
    const hasInlineLeft = slider.style.left !== '';

    if (!hasInlineLeft && lastPos && (Date.now() - lastPos.time < 2000)) {
      slider.style.transition = 'none';
      slider.style.left = lastPos.left;
      slider.style.width = lastPos.width;
      slider.offsetHeight; // force reflow
      slider.style.transition = '';
    }
    
    slider.style.left = newLeftStr;
    slider.style.width = newWidthStr;

    if (window._fluent_last_tab_pos) {
      window._fluent_last_tab_pos[key] = {
        left: newLeftStr,
        width: newWidthStr,
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
            slider.style.left = pos.left;
            slider.style.width = pos.width;
            slider.offsetHeight; // force reflow
            
            slider.style.transition = '';
            updateSlider(ul);
          } catch {
            updateSlider(ul);
          }
        } else {
          updateSlider(ul);
          slider.style.transition = 'none';
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
                    left: slider.style.left,
                    width: slider.style.width
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
    });
  }

  // Initialize tabs & observe changes
  initTabs();
  const bodyObserver = new MutationObserver(() => initTabs());
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
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const form = target.closest('form');
      if (form && !form.getAttribute('target')) {
        showLoading();
      }
    });

    const ajaxObserver = new MutationObserver(() => {
      const hasSpinner = document.querySelector('.spinning, .loading, #view > .spinning') !== null;
      if (hasSpinner) {
        showLoading();
      } else {
        hideLoading();
      }
    });
    ajaxObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
}
