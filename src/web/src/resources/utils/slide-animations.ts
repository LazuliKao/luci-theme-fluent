/**
 * Native JavaScript slide animation utilities
 * Replaces jQuery slideUp/slideDown functionality with better performance
 */
export const SlideAnimations = {
  /**
   * Animation durations in milliseconds
   */
  durations: {
    fast: 200,
    normal: 400,
    slow: 600,
  } as Record<string, number>,

  /**
   * Map to track running animations and their cleanup functions
   */
  runningAnimations: new WeakMap<HTMLElement, { timeoutId: number; cleanup: () => void }>(),

  /**
   * Slide element down (show) with animation
   * @param {HTMLElement} element - DOM element to animate
   * @param {string|number} duration - Animation duration ('fast', 'normal', 'slow' or milliseconds)
   * @param {function} callback - Optional callback function when animation completes
   */
  slideDown(element: HTMLElement | null | undefined, duration?: string | number, callback?: (this: HTMLElement) => void) {
    if (!element) {
      console.warn("SlideAnimations.slideDown: No element provided");
      return;
    }

    // Stop any existing animation on this element
    this.stop(element);

    // Convert duration string to milliseconds
    const animDuration = typeof duration === "string" ? this.durations[duration] || this.durations.normal : duration || this.durations.normal;

    // Store original styles
    const originalStyles = {
      display: element.style.display,
      overflow: element.style.overflow,
      height: element.style.height,
      transition: element.style.transition,
    };

    // Set initial state for animation
    element.style.display = "block";
    element.style.overflow = "hidden";
    element.style.height = "0px";
    element.style.transition = `height ${animDuration}ms ease-out`;

    // Force reflow to ensure initial state is applied
    void element.offsetHeight;

    // Get the target height
    const targetHeight = element.scrollHeight;

    // Animate to full height
    element.style.height = `${targetHeight}px`;

    // Set up cleanup function
    const cleanup = () => {
      element.style.height = originalStyles.height || "";
      element.style.overflow = originalStyles.overflow || "";
      element.style.transition = originalStyles.transition || "";

      // Remove from running animations map
      this.runningAnimations.delete(element);

      if (callback && typeof callback === "function") {
        try {
          callback.call(element);
        } catch (e) {
          console.error("SlideAnimations callback error:", e);
        }
      }
    };

    // Store cleanup function for potential cancellation
    const timeoutId = setTimeout(cleanup, animDuration);
    this.runningAnimations.set(element, { timeoutId, cleanup });
  },

  /**
   * Slide element up (hide) with animation
   * @param {HTMLElement} element - DOM element to animate
   * @param {string|number} duration - Animation duration ('fast', 'normal', 'slow' or milliseconds)
   * @param {function} callback - Optional callback function when animation completes
   */
  slideUp(element: HTMLElement | null | undefined, duration?: string | number, callback?: (this: HTMLElement) => void) {
    if (!element) {
      console.warn("SlideAnimations.slideUp: No element provided");
      return;
    }

    // Stop any existing animation on this element
    this.stop(element);

    // Convert duration string to milliseconds
    const animDuration = typeof duration === "string" ? this.durations[duration] || this.durations.normal : duration || this.durations.normal;

    // Store original styles
    const originalStyles = {
      display: element.style.display,
      overflow: element.style.overflow,
      height: element.style.height,
      transition: element.style.transition,
    };

    // Get current height before hiding
    const currentHeight = element.scrollHeight;

    // Set initial state for animation
    element.style.overflow = "hidden";
    element.style.height = `${currentHeight}px`;
    element.style.transition = `height ${animDuration}ms ease-out`;

    // Force reflow to ensure initial state is applied
    void element.offsetHeight;

    // Animate to zero height
    element.style.height = "0px";

    // Set up cleanup function
    const cleanup = () => {
      element.style.display = "none";
      element.style.height = originalStyles.height || "";
      element.style.overflow = originalStyles.overflow || "";
      element.style.transition = originalStyles.transition || "";

      // Remove from running animations map
      this.runningAnimations.delete(element);

      if (callback && typeof callback === "function") {
        try {
          callback.call(element);
        } catch (e) {
          console.error("SlideAnimations callback error:", e);
        }
      }
    };

    // Store cleanup function for potential cancellation
    const timeoutId = setTimeout(cleanup, animDuration);
    this.runningAnimations.set(element, { timeoutId, cleanup });
  },

  /**
   * Stop all running animations on an element
   * @param {HTMLElement} element - DOM element to stop animations on
   */
  stop(element: HTMLElement | null | undefined) {
    if (!element) return;

    const animationData = this.runningAnimations.get(element);
    if (animationData) {
      // Clear the timeout
      clearTimeout(animationData.timeoutId);

      // Run cleanup immediately
      animationData.cleanup();
    }

    // Clear transition to immediately stop any CSS animation
    element.style.transition = "";

    // Force reflow to apply changes immediately
    void element.offsetHeight;
  },

  /**
   * Check if element has running animation
   * @param {HTMLElement} element - DOM element to check
   * @returns {boolean} - True if element has running animation
   */
  isAnimating(element: HTMLElement): boolean {
    return this.runningAnimations.has(element);
  },
};
