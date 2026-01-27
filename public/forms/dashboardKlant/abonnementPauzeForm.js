// public/forms/dashboardKlant/abonnementPauzeForm.js
/**
 * Pauze formulier voor abonnement detail pagina
 * Gebruikt weeknummer selectie zoals bij opzeggen
 * Toont pauze geschiedenis
 */

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { initWeekSelectTrigger } from '../logic/formTriggers.js';
import { apiClient } from '../../utils/api/client.js';
import { authClient } from '../../utils/auth/authClient.js';

/**
 * Render pauze geschiedenis in data-pauze-geschiedenis element
 */
function renderPauzeGeschiedenis(pauzes) {
  const geschiedenisEl = document.querySelector('[data-pauze-geschiedenis]');
  if (!geschiedenisEl) return;

  if (!pauzes || pauzes.length === 0) {
    geschiedenisEl.textContent = 'Nog geen pauzes aangevraagd';
    geschiedenisEl.style.fontStyle = 'italic';
    geschiedenisEl.style.color = '#666';
    return;
  }

  // Sorteer pauzes op start week (nieuwste eerst)
  const gesorteerd = [...pauzes].sort((a, b) => {
    if (b.pauze_start_jaar !== a.pauze_start_jaar) {
      return b.pauze_start_jaar - a.pauze_start_jaar;
    }
    return b.pauze_start_weeknr - a.pauze_start_weeknr;
  });

  const html = gesorteerd.map(pauze => {
    return `Pauze van week ${pauze.pauze_start_weeknr} (${pauze.pauze_start_jaar}) tot week ${pauze.eerste_schoonmaak_week} (${pauze.eerste_schoonmaak_jaar})`;
  }).join('<br>');

  geschiedenisEl.innerHTML = html;
  geschiedenisEl.style.fontStyle = 'normal';
  geschiedenisEl.style.color = 'inherit';
}

/**
 * Bereken ISO weeknummer voor een datum
 */
function getISOWeek(date) {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
}

/**
 * Custom validator: eerste schoonmaak week moet na start week zijn
 */
function validateEersteAfterStart(formElement) {
  const startInput = formElement.querySelector('[data-field-name="pauze_start_weeknr"]');
  const eersteInput = formElement.querySelector('[data-field-name="pauze_eerste_schoonmaak_terug"]');
  
  if (!startInput || !eersteInput) return true;

  const startWeek = parseInt(startInput.value, 10);
  const eersteWeek = parseInt(eersteInput.value, 10);
  const startYear = parseInt(startInput.dataset.weekYear || new Date().getFullYear(), 10);
  const eersteYear = parseInt(eersteInput.dataset.weekYear || new Date().getFullYear(), 10);

  if (isNaN(startWeek) || isNaN(eersteWeek)) return true;

  // Simpele check: zelfde jaar -> week nummer vergelijken
  // Anders jaar -> jaar vergelijken
  if (startYear === eersteYear) {
    return eersteWeek > startWeek;
  }
  
  return eersteYear > startYear;
}

/**
 * Initialiseer pauze formulier
 * @param {Object} data - Abonnement data
 */
export async function initAbonnementPauzeForm(data) {
  console.log('⏸️ [Abonnement Pauze] Initialiseren pauze formulier...');

  // Haal pauze geschiedenis op en render
  try {
    const authState = authClient.getAuthState();
    const pauzes = await apiClient(`/routes/dashboard/klant/pauze-geschiedenis?abonnement_id=${data.id}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authState.access_token}` }
    });
    renderPauzeGeschiedenis(pauzes);
  } catch (error) {
    console.warn('⚠️ [Abonnement Pauze] Kon pauze geschiedenis niet ophalen:', error);
    renderPauzeGeschiedenis([]);
  }

  // Check of abonnement is opgezegd (pauze is wel toegestaan, maar opzeggen niet)
  if (data.canceled_at) {
    console.warn('⚠️ [Abonnement Pauze] Abonnement is opgezegd, pauze niet mogelijk');
    return;
  }

  const formElement = document.querySelector('[data-form-name="abb_pauze-form"]');
  if (!formElement) {
    console.warn('⚠️ [Abonnement Pauze] Pauze formulier niet gevonden in DOM');
    return;
  }

  const schema = getFormSchema('abb_pauze-form');
  if (!schema) {
    console.error('❌ [Abonnement Pauze] Schema voor abb_pauze-form niet gevonden');
    return;
  }

  // Custom submit action
  schema.submit = {
    action: async (formData) => {
      console.log('📤 [Abonnement Pauze] Submitting pauze...', formData);

      // Haal jaren op uit hidden dataset attributen (gezet door initWeekSelectTrigger)
      const startInput = formElement.querySelector('[data-field-name="pauze_start_weeknr"]');
      const eersteInput = formElement.querySelector('[data-field-name="pauze_eerste_schoonmaak_terug"]');
      const start_jaar = startInput?.dataset.weekYear || new Date().getFullYear();
      const eerste_jaar = eersteInput?.dataset.weekYear || new Date().getFullYear();

      // Extra validatie: eerste week moet na start week zijn
      if (!validateEersteAfterStart(formElement)) {
        throw new Error('INVALID_WEEK_RANGE');
      }

      const authState = authClient.getAuthState();
      const response = await apiClient('/routes/dashboard/klant/pauze-abonnement', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: {
          id: data.id,
          pauze_start_weeknr: formData.pauze_start_weeknr,
          pauze_start_jaar: start_jaar,
          eerste_schoonmaak_week: formData.pauze_eerste_schoonmaak_terug,
          eerste_schoonmaak_jaar: eerste_jaar,
          pauze_reden: formData.pauze_reden || ''
        }
      });

      console.log('✅ [Abonnement Pauze] Pauze succesvol:', response);
      return { message: 'Abonnement succesvol gepauzeerd' };
    },
    onSuccess: () => {
      const formName = 'abb_pauze-form';
      formHandler.showSuccessState(formName, {
        messageAttribute: formName,
        hideForm: false,
        scrollIntoView: false
      });
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        const successEl = document.querySelector(`[data-success-message="${formName}"]`);
        if (successEl) successEl.style.display = 'none';
      }, 5000);

      // Reload page na 2 seconden om nieuwe status te tonen
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  };

  // Initialize formHandler
  formHandler.init(schema);

  // Helper functie: bereken week + 1 met jaarwisseling
  function getNextWeek(weekNum, year) {
    const weeksInYear = weeksInISOYear(year);
    let nextWeek = weekNum + 1;
    let nextYear = year;
    
    if (nextWeek > weeksInYear) {
      nextWeek = 1;
      nextYear = year + 1;
    }
    
    return { week: nextWeek, year: nextYear };
  }

  function weeksInISOYear(year) {
    const dec28 = new Date(Date.UTC(year, 11, 28));
    const tmp = new Date(Date.UTC(dec28.getFullYear(), dec28.getMonth(), dec28.getDate()));
    tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    return Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
  }

  // Initialiseer week selectors
  // Startweek pauze: vanaf huidige week tot 52 weken vooruit
  const startWeekTrigger = initWeekSelectTrigger(formHandler, {
    weekField: 'pauze_start_weeknr',
    infoField: 'pauze_start_weeknr',
    minWeeksAhead: 0, // Kan huidige week zijn
    maxWeeks: 52 // Flexibiliteit voor plannen ver vooruit
  });

  // Eerste schoonmaak terug: zelfde bereik (gebruiker kiest binnen dit bereik)
  const eersteSchoonmaakTrigger = initWeekSelectTrigger(formHandler, {
    weekField: 'pauze_eerste_schoonmaak_terug',
    infoField: 'pauze_eerste_schoonmaak_terug',
    minWeeksAhead: 0,
    maxWeeks: 52
  });

  // Haal input elementen op
  const startInput = formElement.querySelector('[data-field-name="pauze_start_weeknr"]');
  const eersteInput = formElement.querySelector('[data-field-name="pauze_eerste_schoonmaak_terug"]');
  const eersteInfoElement = formElement.querySelector('[data-field-info="pauze_eerste_schoonmaak_terug"]');

  // Prefill: Zet eerste schoonmaak terug automatisch op start + 2 weken
  if (startInput && eersteInput) {
    const startWeek = parseInt(startInput.value, 10);
    const startYear = parseInt(startInput.dataset.weekYear, 10);
    
    if (!isNaN(startWeek) && !isNaN(startYear)) {
      const eenWeek = getNextWeek(startWeek, startYear);
      const tweeWeken = getNextWeek(eenWeek.week, eenWeek.year);
      eersteInput.value = String(tweeWeken.week);
      eersteInput.dataset.weekYear = String(tweeWeken.year);
      
      // Update info display
      if (eersteInfoElement) {
        const startDate = getStartDateOfISOWeek(tweeWeken.week, tweeWeken.year);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        eersteInfoElement.textContent = `Week ${tweeWeken.week} (${formatDate(startDate, tweeWeken.year)} \u2013 ${formatDate(endDate, tweeWeken.year)})`;
      }
      
      // Sync met formHandler
      if (formHandler.formData) {
        formHandler.formData['pauze_eerste_schoonmaak_terug'] = eersteInput.value;
        if (formHandler.formState['pauze_eerste_schoonmaak_terug']) {
          formHandler.formState['pauze_eerste_schoonmaak_terug'].isTouched = true;
        }
      }
      eersteInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // Auto-update eerste schoonmaak terug bij start week wijziging
  if (startInput && eersteInput) {
    startInput.addEventListener('input', () => {
      const startWeek = parseInt(startInput.value, 10);
      const startYear = parseInt(startInput.dataset.weekYear, 10);
      
      if (!isNaN(startWeek) && !isNaN(startYear)) {
        const eenWeek = getNextWeek(startWeek, startYear);
        const tweeWeken = getNextWeek(eenWeek.week, eenWeek.year);
        eersteInput.value = String(tweeWeken.week);
        eersteInput.dataset.weekYear = String(tweeWeken.year);
        
        // Update info display
        if (eersteInfoElement) {
          const startDate = getStartDateOfISOWeek(tweeWeken.week, tweeWeken.year);
          const endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          eersteInfoElement.textContent = `Week ${tweeWeken.week} (${formatDate(startDate, tweeWeken.year)} \u2013 ${formatDate(endDate, tweeWeken.year)})`;
        }
        
        // Trigger change voor formHandler update
        eersteInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Validatie trigger
    startInput.addEventListener('change', () => {
      if (eersteInput.value) {
        eersteInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  // Helper functies voor datum formatting
  function getStartDateOfISOWeek(week, year) {
    const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
    const dayOfWeek = simple.getUTCDay() || 7;
    if (dayOfWeek > 4) {
      simple.setUTCDate(simple.getUTCDate() + 8 - dayOfWeek);
    } else {
      simple.setUTCDate(simple.getUTCDate() - (dayOfWeek - 1));
    }
    return simple;
  }

  function formatDate(date, year) {
    const displayYear = year || date.getUTCFullYear();
    return `${date.getUTCDate()} ${date.toLocaleString('nl-NL', { month: 'long', timeZone: 'UTC' })} ${displayYear}`;
  }

  console.log('✅ [Abonnement Pauze] Pauze formulier geïnitialiseerd');
}
