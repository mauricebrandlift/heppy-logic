/**
 * Definitie van JSON-schema's voor formulieren.
 * Bevat per formulier (en optioneel per group) de velddefinities, validatieregels en custom foutberichten.
 *
 * @module public/forms/schemas/formSchema
 * @version 1.0.1
 */

/**
 * Form-schema's:
 * - Velden: per veld type, required, pattern en optioneel message.
 * - Group: optioneel naam voor shared storage key.
 */
export const formSchemas = {
  'postcode-form': {
    fields: {
      postcode: {
        type: 'string',
        required: true,
        /** Nederlandse postcode: 4 cijfers + 2 letters, zonder spatie */
        pattern: /^[0-9]{4}[A-Za-z]{2}$/,
        /** Foutmelding bij ongeldig formaat */
        message: 'Gebruik 4 cijfers gevolgd door 2 letters, zonder spatie'
      },
      huisnummer: {
        type: 'string',
        required: true,
        /** Nummering: minimaal 1, maximaal 5 cijfers */
        pattern: /^\d{1,5}$/,
        /** Foutmelding bij ongeldig huisnummer */
        message: 'Voer een huisnummer van 1 tot 5 cijfers in'
      },
      toevoeging: {
        type: 'string',
        required: false,
        /** Eventuele toevoeging: letters en cijfers, max 4 tekens */
        pattern: /^[A-Za-z0-9]{0,4}$/,
        /** Foutmelding bij ongeldig toevoeging */
        message: 'Maximaal 4 letters of cijfers'
      }
    },
    // Geen shared group voor dit formulier
    group: null
  }
};
