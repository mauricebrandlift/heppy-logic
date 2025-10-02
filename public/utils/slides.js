// public/utils/slides.js
// Helper om naar een slide te springen op basis van data-form-name
// Vereist dat Webflow slider structuur beschikbaar is en dat elke slide het formulier bevat of wrapper met data-form-name

(function() {
  if (window.jumpToSlideByFormName) return; // voorkom dubbele definitie
  window.jumpToSlideByFormName = function(formName) {
    try {
      const target = document.querySelector(`[data-form-name="${formName}"]`);
      if (!target) {
        console.warn('[Slides] Geen element gevonden voor formName', formName);
        return false;
      }
      // Vind dichtstbijzijnde slide
      const slideEl = target.closest('.w-slide');
      if (!slideEl) {
        console.warn('[Slides] Geen .w-slide ancestor gevonden voor', formName);
        return false;
      }
      const slider = slideEl.closest('.w-slider');
      if (!slider) {
        console.warn('[Slides] Geen slider gevonden.');
        return false;
      }
      const slides = Array.from(slider.querySelectorAll('.w-slide'));
      const idx = slides.indexOf(slideEl);
      if (idx === -1) return false;
      // Webflow exposeert slider API via data / triggers - fallback gebruiken via nav dots of Arrow keys triggers.
      // Simpele fallback: herhaaldelijk moveToNextSlide tot index bereikt.
      if (typeof window.moveToNextSlide === 'function') {
        const currentIndexEl = slider.querySelector('.w-slider-nav .w-active');
        let currentIdx = -1;
        if (currentIndexEl) {
          currentIdx = Array.from(slider.querySelectorAll('.w-slider-nav div')).indexOf(currentIndexEl);
        }
        if (currentIdx === -1) currentIdx = 0;
        while (currentIdx < idx) {
          window.moveToNextSlide();
          currentIdx++;
        }
        return true;
      }
      // Als nav dots bestaan, klik direct op de juiste dot
      const navDots = slider.querySelectorAll('.w-slider-nav div');
      if (navDots && navDots[idx]) {
        navDots[idx].click();
        return true;
      }
      return false;
    } catch (e) {
      console.error('[Slides] Fout bij jumpToSlideByFormName:', e);
      return false;
    }
  }
})();
