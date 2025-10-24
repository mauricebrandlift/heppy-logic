/**
 * Funnel Tracking Client
 * Frontend utility voor het tracken van user journey
 * 
 * Gebruik:
 * import { FunnelTracker } from './utils/tracking/funnelTrac  async linkUser(userId) {  async linkPayment(paymentIntentId) {
    console.log(`💳 [FunnelTracker] Linking payment: ${paymentIntentId}`);
    
    try {
      await apiClient.patch('/api/routes/tracking/link-payment', {
        sessionId: this.sessionId,
        paymentIntentId
      });
      
      console.log(`✅ [FunnelTracker] Payment linked: ${paymentIntentId}`);ole.log(`👤 [FunnelTracker] Linking user: ${userId}`);
    
    try {
      await apiClient.patch('/api/routes/tracking/link-user', {
        sessionId: this.sessionId,
        userId
      });
      
      console.log(`✅ [FunnelTracker] User linked: ${userId}`); * 
 * // Bij formulier start
 * const tracker = new FunnelTracker('abonnement');
 * await tracker.start();
 * 
 * // Bij elke stap transitie
 * await tracker.trackStep('adres', 1, { postcode, plaats });
 * 
 * // Bij voltooiing
 * await tracker.complete(aanvraagId);
 */

import { apiClient } from '../api/client.js';

// Stap definities per flow type
const FLOW_STEPS = {
  abonnement: [
    { name: 'adres', order: 1, label: 'Adres & Dekking' },
    { name: 'opdracht', order: 2, label: 'Schoonmaak Opdracht' },
    { name: 'dagdelen', order: 3, label: 'Dagdelen & Schoonmaker' },
    { name: 'persoonsgegevens', order: 4, label: 'Persoonsgegevens' },
    { name: 'betaling', order: 5, label: 'Betaling' },
    { name: 'success', order: 6, label: 'Succesvol' }
  ],
  eenmalig: [
    { name: 'adres', order: 1, label: 'Adres & Dekking' },
    { name: 'opdracht', order: 2, label: 'Schoonmaak Opdracht' },
    { name: 'persoonsgegevens', order: 3, label: 'Persoonsgegevens' },
    { name: 'betaling', order: 4, label: 'Betaling' },
    { name: 'success', order: 5, label: 'Succesvol' }
  ],
  werken_bij: [
    { name: 'persoonsgegevens', order: 1, label: 'Persoonsgegevens' },
    { name: 'motivatie', order: 2, label: 'Motivatie' },
    { name: 'upload', order: 3, label: 'Documenten Uploaden' },
    { name: 'success', order: 4, label: 'Succesvol' }
  ]
};

export class FunnelTracker {
  constructor(flowType) {
    this.flowType = flowType;
    this.sessionId = this.getOrCreateSessionId();
    this.currentStep = null;
    this.stepStartTime = null;
    this.steps = FLOW_STEPS[flowType] || [];
  }

  /**
   * Haal of maak session ID (persisteert in localStorage)
   */
  getOrCreateSessionId() {
    const storageKey = `heppy_tracking_session_${this.flowType}`;
    let sessionId = localStorage.getItem(storageKey);
    
    if (!sessionId) {
      sessionId = this.generateUUID();
      localStorage.setItem(storageKey, sessionId);
      console.log(`📊 [FunnelTracker] Created new session: ${sessionId}`);
    } else {
      console.log(`📊 [FunnelTracker] Using existing session: ${sessionId}`);
    }
    
    return sessionId;
  }

  /**
   * Genereer UUID v4
   */
  generateUUID() {
    if (crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Detect device type
   */
  getDeviceType() {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  /**
   * Start tracking sessie
   */
  async start() {
    console.log(`🎯 [FunnelTracker] Starting tracking for ${this.flowType}`);
    
    const metadata = {
      deviceType: this.getDeviceType(),
      referrerUrl: document.referrer || null,
      userAgent: navigator.userAgent,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight
    };
    
    try {
      await apiClient.post('/api/routes/tracking/start', {
        sessionId: this.sessionId,
        flowType: this.flowType,
        metadata
      });
      
      console.log(`✅ [FunnelTracker] Session started: ${this.sessionId}`);
    } catch (error) {
      console.error('❌ [FunnelTracker] Failed to start session:', error);
      // Non-fatal: tracking failure shouldn't break user experience
    }
  }

  /**
   * Track stap transitie
   */
  async trackStep(stepName, stepOrder, formData = {}) {
    console.log(`📊 [FunnelTracker] Tracking step: ${stepName} (${stepOrder})`);
    
    // Bereken tijd besteed aan vorige stap
    let timeSpent = null;
    let previousStep = this.currentStep;
    
    if (this.stepStartTime && this.currentStep) {
      const now = Date.now();
      timeSpent = Math.floor((now - this.stepStartTime) / 1000); // seconden
      console.log(`⏱️ [FunnelTracker] Time spent on ${this.currentStep}: ${timeSpent}s`);
    }
    
    // Update huidige stap
    this.currentStep = stepName;
    this.stepStartTime = Date.now();
    
    try {
      await apiClient.patch('/api/routes/tracking/step', {
        sessionId: this.sessionId,
        stepName,
        stepOrder,
        formData,
        completed: false, // Wordt true bij volgende stap
        previousStep,
        timeSpent
      });
      
      console.log(`✅ [FunnelTracker] Step tracked: ${stepName}`);
    } catch (error) {
      console.error('❌ [FunnelTracker] Failed to track step:', error);
      // Non-fatal
    }
  }

  /**
   * Link user ID (zodra email bekend is)
   */
  async linkUser(userId) {
    console.log(`👤 [FunnelTracker] Linking user: ${userId}`);
    
    try {
      await apiClient.patch('/api/tracking/link-user', {
        sessionId: this.sessionId,
        userId
      });
      
      console.log(`✅ [FunnelTracker] User linked`);
    } catch (error) {
      console.error('❌ [FunnelTracker] Failed to link user:', error);
    }
  }

  /**
   * Link payment intent
   */
  async linkPayment(paymentIntentId) {
    console.log(`💳 [FunnelTracker] Linking payment intent: ${paymentIntentId}`);
    
    try {
      await apiClient.patch('/api/tracking/link-payment', {
        sessionId: this.sessionId,
        paymentIntentId
      });
      
      console.log(`✅ [FunnelTracker] Payment intent linked`);
    } catch (error) {
      console.error('❌ [FunnelTracker] Failed to link payment:', error);
    }
  }

  /**
   * Voltooi sessie (na succesvolle betaling)
   */
  async complete(aanvraagId = null) {
    console.log(`✅ [FunnelTracker] Completing session`);
    
    try {
      await apiClient.patch('/api/tracking/complete', {
        sessionId: this.sessionId,
        aanvraagId
      });
      
      console.log(`✅ [FunnelTracker] Session completed`);
      
      // Clear session uit localStorage
      const storageKey = `heppy_tracking_session_${this.flowType}`;
      localStorage.removeItem(storageKey);
      
    } catch (error) {
      console.error('❌ [FunnelTracker] Failed to complete session:', error);
    }
  }

  /**
   * Helper: Vind step info by name
   */
  getStepInfo(stepName) {
    return this.steps.find(s => s.name === stepName);
  }

  /**
   * Helper: Vorige stap
   */
  getPreviousStep(currentStepName) {
    const current = this.getStepInfo(currentStepName);
    if (!current || current.order === 1) return null;
    return this.steps.find(s => s.order === current.order - 1);
  }

  /**
   * Helper: Volgende stap
   */
  getNextStep(currentStepName) {
    const current = this.getStepInfo(currentStepName);
    if (!current) return null;
    return this.steps.find(s => s.order === current.order + 1);
  }

  /**
   * Debug info
   */
  getDebugInfo() {
    return {
      sessionId: this.sessionId,
      flowType: this.flowType,
      currentStep: this.currentStep,
      totalSteps: this.steps.length,
      deviceType: this.getDeviceType()
    };
  }
}

// Singleton instance per flow type
const trackerInstances = {};

/**
 * Get or create tracker instance
 */
export function getTracker(flowType) {
  if (!trackerInstances[flowType]) {
    trackerInstances[flowType] = new FunnelTracker(flowType);
  }
  return trackerInstances[flowType];
}

/**
 * Shorthand functies voor quick access
 */
export const tracking = {
  start: (flowType) => getTracker(flowType).start(),
  step: (flowType, stepName, stepOrder, formData) => 
    getTracker(flowType).trackStep(stepName, stepOrder, formData),
  linkUser: (flowType, userId) => getTracker(flowType).linkUser(userId),
  linkPayment: (flowType, paymentIntentId) => 
    getTracker(flowType).linkPayment(paymentIntentId),
  complete: (flowType, aanvraagId) => getTracker(flowType).complete(aanvraagId)
};
