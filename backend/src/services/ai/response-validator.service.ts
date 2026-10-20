import { Diagnosis } from '../../models/diagnosis.model';
import { logger } from '../../utils/logger';

export function validateDiagnosis(data: any): { valid: boolean; diagnosis?: Diagnosis; errors?: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Response is not a valid object'] };
  }

  // Required fields
  const requiredStrings = ['severity', 'title', 'rootCause', 'summary'];
  for (const field of requiredStrings) {
    if (typeof data[field] !== 'string' || !data[field]) {
      errors.push(`Missing or invalid field: ${field}`);
    }
  }

  if (typeof data.confidence !== 'number' || data.confidence < 0 || data.confidence > 1) {
    // Try to fix confidence as percentage
    if (typeof data.confidence === 'number' && data.confidence > 1 && data.confidence <= 100) {
      data.confidence = data.confidence / 100;
    } else {
      errors.push('Invalid confidence value');
      data.confidence = 0.5; // default
    }
  }

  // Validate severity
  const validSeverities = ['critical', 'error', 'warning', 'info'];
  if (!validSeverities.includes(data.severity)) {
    data.severity = 'warning';
  }

  // Arrays with defaults
  if (!Array.isArray(data.evidence)) data.evidence = [];
  if (!Array.isArray(data.possibleCauses)) data.possibleCauses = [];
  if (!Array.isArray(data.verificationCommands)) data.verificationCommands = [];
  if (!Array.isArray(data.remediationCommands)) data.remediationCommands = [];
  if (!Array.isArray(data.warnings)) data.warnings = [];
  if (!Array.isArray(data.additionalInvestigation)) data.additionalInvestigation = [];

  // Solution
  if (!data.solution || typeof data.solution !== 'object') {
    data.solution = { explanation: '', steps: [] };
  }
  if (!Array.isArray(data.solution.steps)) {
    data.solution.steps = [];
  }

  if (errors.length > 0) {
    logger.warn(`Diagnosis validation issues: ${errors.join(', ')}`);
  }

  // We'll be lenient - try to use what we have
  const diagnosis: Diagnosis = {
    severity: data.severity,
    title: data.title || 'Analysis Complete',
    rootCause: data.rootCause || 'Unable to determine root cause',
    confidence: data.confidence,
    summary: data.summary || '',
    evidence: data.evidence,
    possibleCauses: data.possibleCauses,
    solution: data.solution,
    verificationCommands: data.verificationCommands,
    remediationCommands: data.remediationCommands,
    warnings: data.warnings,
    additionalInvestigation: data.additionalInvestigation,
  };

  return { valid: true, diagnosis };
}

export function extractJSON(text: string): any {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {}

  // Try to find JSON in markdown code fences
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {}
  }

  // Try to find a JSON object in the text
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {}
  }

  return null;
}
