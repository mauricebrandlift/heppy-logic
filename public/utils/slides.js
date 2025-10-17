// public/utils/slides.js
// Uitgebreide helper voor zowel Webflow slider (.w-slide) als Splide (.splide__slide)
// Doel: naar een slide springen o.b.v. data-form-name of naar laatste slide.

(function() {
  if (window.jumpToSlideByFormName && window.jumpToLastSlide && window.navigateToFormStep) return; // al geladen

  let navigationLock = false;
  let navigationUnlockTimer = null;

  function releaseNavigationLock() {
    if (!navigationLock) return;
    navigationLock = false;
    if (navigationUnlockTimer) {
      clearTimeout(navigationUnlockTimer);
      navigationUnlockTimer = null;
    }
  }

  function acquireNavigationLock(timeout = 1200) {
    if (navigationLock) return false;
    navigationLock = true;
    if (navigationUnlockTimer) {
      clearTimeout(navigationUnlockTimer);
      navigationUnlockTimer = null;
    }
    navigationUnlockTimer = setTimeout(() => {
      navigationUnlockTimer = null;
      navigationLock = false;
    }, timeout);
    return true;
  }

  function findSplideContext(target) {
    const splideSlide = target.closest('.splide__slide');
    if (!splideSlide) return null;
    const root = splideSlide.closest('.splide');
    if (!root) return null;
    const instance = root.splide || (window.Splide && window.Splide.instances ? Object.values(window.Splide.instances).find(i => i?.root === root) : null);
    if (!instance) {
      console.warn('[Slides] Splide root gevonden maar geen instance (misschien init timing).');
      return { instance: null, index: -1, slides: Array.from(root.querySelectorAll('.splide__slide')), root };
    }
    const slides = Array.from(root.querySelectorAll('.splide__slide'));
    const index = slides.indexOf(splideSlide);
    return index >= 0 ? { instance, index, slides } : null;
  }

  function gotoSplideIndex(ctx) {
    try {
      ctx.instance.go(ctx.index);
      return true;
    } catch (e) {
      console.warn('[Slides] Splide navigatie fout:', e);
      return false;
    }
  }

  function findWebflowContext(target) {
    const slideEl = target.closest('.w-slide');
    if (!slideEl) return null;
    const slider = slideEl.closest('.w-slider');
    if (!slider) return null;
    const slides = Array.from(slider.querySelectorAll('.w-slide'));
    const idx = slides.indexOf(slideEl);
    if (idx === -1) return null;
    return { slider, idx };
  }

  function gotoWebflowIndex(ctx) {
    // Probeer nav dots eerst
    const navDots = ctx.slider.querySelectorAll('.w-slider-nav div');
    if (navDots && navDots[ctx.idx]) {
      navDots[ctx.idx].click();
      return true;
    }
    if (typeof window.moveToNextSlide === 'function') {
      // fallback: iteratief vooruit
      let currentIdx = 0;
      const active = ctx.slider.querySelector('.w-slider-nav .w-active');
      if (active) {
        currentIdx = Array.from(ctx.slider.querySelectorAll('.w-slider-nav div')).indexOf(active);
        if (currentIdx < 0) currentIdx = 0;
      }
      while (currentIdx < ctx.idx) {
        window.moveToNextSlide();
        currentIdx++;
      }
      return true;
    }
    console.warn('[Slides] Geen methode om Webflow slide te veranderen gevonden');
    return false;
  }

  window.jumpToSlideByFormName = function(formName, { retry = 3, retryDelay = 50 } = {}) {
    try {
      const target = document.querySelector(`[data-form-name="${formName}"]`);
      if (!target) {
        if (retry > 0) {
          setTimeout(() => window.jumpToSlideByFormName(formName, { retry: retry - 1, retryDelay }), retryDelay);
          return false;
        }
        console.warn('[Slides] Geen element gevonden voor formName', formName);
        return false;
      }

      // 1) Probeer Splide
      const splideCtx = findSplideContext(target);
      if (splideCtx) {
        if (!splideCtx.instance) {
          // Probeer later opnieuw (Splide wellicht nog niet geïnitialiseerd)
          if (retry > 0) {
            setTimeout(() => window.jumpToSlideByFormName(formName, { retry: retry - 1, retryDelay }), retryDelay * 2);
            return false;
          }
          console.warn('[Slides] Geen Splide instance beschikbaar na retries voor', formName, '- fallback naar lastSlide');
          return window.jumpToLastSlide();
        }
        return gotoSplideIndex(splideCtx);
      }

      // 2) Probeer Webflow
      const wfCtx = findWebflowContext(target);
      if (wfCtx) {
        return gotoWebflowIndex(wfCtx);
      }

      // 3) Fallback: geen slider → toon alleen dit form element en verberg andere forms (hard switch)
      console.warn('[Slides] Geen slider ancestor. Gebruik directe fallback voor', formName);
      const allForms = Array.from(document.querySelectorAll('[data-form-name]'));
      allForms.forEach(el => {
        if (el === target) {
          el.style.display = '';
        } else {
          el.style.display = 'none';
        }
      });
      // Start observer om later alsnog naar echte slider te springen als Splide init vertraagd is
      let observed = false;
      const observer = new MutationObserver(() => {
        const splideCtxLate = findSplideContext(target);
        if (splideCtxLate && splideCtxLate.instance) {
          console.log('[Slides] Late Splide instance gevonden, navigeer opnieuw naar', formName);
          gotoSplideIndex(splideCtxLate);
          observer.disconnect();
        }
      });
      if (!findSplideContext(target)?.instance) {
        observer.observe(document.documentElement, { childList: true, subtree: true });
        observed = true;
      }
      if (observed) console.log('[Slides] Observer actief voor late Splide init');
      return true;
    } catch (e) {
      console.error('[Slides] Fout bij jumpToSlideByFormName:', e);
      return false;
    }
  };

  window.navigateToFormStep = function(currentFormName, nextFormName, { retry = 3, retryDelay = 80 } = {}) {
    if (!nextFormName) {
      console.warn('[Slides] navigateToFormStep vereist nextFormName');
      return false;
    }

    const target = document.querySelector(`[data-form-name="${nextFormName}"]`);
    if (!target) {
      console.warn('[Slides] navigateToFormStep kon target niet vinden voor', nextFormName);
      return false;
    }

    if (!acquireNavigationLock()) {
      console.warn('[Slides] Navigatie geblokkeerd door lopende overgang');
      return false;
    }

    const splideCtx = findSplideContext(target);

    const succeeded = window.jumpToSlideByFormName
      ? window.jumpToSlideByFormName(nextFormName, { retry, retryDelay })
      : (typeof window.moveToNextSlide === 'function' ? (window.moveToNextSlide(), true) : false);

    if (!succeeded) {
      releaseNavigationLock();
      return false;
    }

    if (splideCtx && splideCtx.instance) {
      const releaseOnMove = () => {
        releaseNavigationLock();
        splideCtx.instance.off('moved', releaseOnMove);
      };
      splideCtx.instance.on('moved', releaseOnMove);
    } else {
      setTimeout(() => releaseNavigationLock(), 600);
    }

    return true;
  };

  window.jumpToLastSlide = function({ selector = '.splide', retry = 3, retryDelay = 50 } = {}) {
    try {
      const splideRoot = document.querySelector(selector);
      if (splideRoot && splideRoot.splide) {
        const inst = splideRoot.splide;
        const total = inst.Components.Elements.slides.length;
        if (total > 0) {
          inst.go(total - 1);
          return true;
        }
      }
      // Webflow fallback
      const wfSlider = document.querySelector('.w-slider');
      if (wfSlider) {
        const slides = wfSlider.querySelectorAll('.w-slide');
        if (slides.length) {
          const target = slides[slides.length - 1];
          // nav dots attempt
            const navDots = wfSlider.querySelectorAll('.w-slider-nav div');
            if (navDots && navDots.length >= slides.length) {
              navDots[slides.length - 1].click();
              return true;
            }
          if (typeof window.moveToNextSlide === 'function') {
            // brute force
            for (let i=0;i<slides.length;i++) window.moveToNextSlide();
            return true;
          }
        }
      }
      // Fallback direct (geen slider). Laatste form-name element tonen.
      const formEls = Array.from(document.querySelectorAll('[data-form-name]'));
      if (formEls.length) {
        formEls.forEach((el, idx) => {
          el.style.display = (idx === formEls.length - 1) ? '' : 'none';
        });
        console.warn('[Slides] Fallback jumpToLastSlide zonder slider structuur.');
        return true;
      }
      if (retry > 0) {
        setTimeout(() => window.jumpToLastSlide({ selector, retry: retry - 1, retryDelay }), retryDelay);
        return false;
      }
      console.warn('[Slides] Geen slider gevonden voor jumpToLastSlide');
      return false;
    } catch (e) {
      console.error('[Slides] Fout bij jumpToLastSlide:', e);
      return false;
    }
  };
})();
