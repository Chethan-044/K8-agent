import { describe, it, expect } from 'vitest';
import { validateDiagnosis, extractJSON } from '../../src/services/ai/response-validator.service';

describe('Response Validator', () => {
  describe('extractJSON', () => {
    it('should parse valid JSON directly', () => {
      const json = '{"title": "Test", "severity": "critical"}';
      const result = extractJSON(json);
      expect(result).toEqual({ title: 'Test', severity: 'critical' });
    });

    it('should extract JSON from markdown code fence', () => {
      const text = '```json\n{"title": "Test"}\n```';
      const result = extractJSON(text);
      expect(result).toEqual({ title: 'Test' });
    });

    it('should extract JSON from plain code fence', () => {
      const text = '```\n{"title": "Test"}\n```';
      const result = extractJSON(text);
      expect(result).toEqual({ title: 'Test' });
    });

    it('should extract JSON embedded in text', () => {
      const text = 'Here is the analysis:\n{"title": "Test", "severity": "warning"}\nDone.';
      const result = extractJSON(text);
      expect(result).toEqual({ title: 'Test', severity: 'warning' });
    });

    it('should return null for non-JSON text', () => {
      const text = 'This is not JSON at all';
      const result = extractJSON(text);
      expect(result).toBeNull();
    });
  });

  describe('validateDiagnosis', () => {
    const validDiagnosis = {
      severity: 'critical',
      title: 'MongoDB Connection Failure',
      rootCause: 'MongoDB service has no endpoints',
      confidence: 0.94,
      summary: 'The pod is crashing because MongoDB is unreachable',
      evidence: [{ fact: 'Connection error in logs', importance: 'high' }],
      possibleCauses: [{ cause: 'MongoDB is down', likelihood: 'high' }],
      solution: { explanation: 'Fix MongoDB', steps: ['Check MongoDB pods'] },
      verificationCommands: [{ command: 'kubectl get pods', purpose: 'Check pods' }],
      remediationCommands: [{ command: 'kubectl rollout restart', purpose: 'Restart', risk: 'low' }],
      warnings: ['This is a warning'],
      additionalInvestigation: ['Check network'],
    };

    it('should validate a correct diagnosis', () => {
      const result = validateDiagnosis(validDiagnosis);
      expect(result.valid).toBe(true);
      expect(result.diagnosis).toBeDefined();
      expect(result.diagnosis!.title).toBe('MongoDB Connection Failure');
    });

    it('should handle confidence as percentage', () => {
      const data = { ...validDiagnosis, confidence: 94 };
      const result = validateDiagnosis(data);
      expect(result.valid).toBe(true);
      expect(result.diagnosis!.confidence).toBe(0.94);
    });

    it('should fix invalid severity to warning', () => {
      const data = { ...validDiagnosis, severity: 'invalid' };
      const result = validateDiagnosis(data);
      expect(result.valid).toBe(true);
      expect(result.diagnosis!.severity).toBe('warning');
    });

    it('should default missing arrays to empty arrays', () => {
      const data = {
        severity: 'warning',
        title: 'Test',
        rootCause: 'Unknown',
        confidence: 0.5,
        summary: 'Test',
      };
      const result = validateDiagnosis(data);
      expect(result.valid).toBe(true);
      expect(result.diagnosis!.evidence).toEqual([]);
      expect(result.diagnosis!.verificationCommands).toEqual([]);
      expect(result.diagnosis!.warnings).toEqual([]);
    });

    it('should reject null input', () => {
      const result = validateDiagnosis(null);
      expect(result.valid).toBe(false);
    });

    it('should reject non-object input', () => {
      const result = validateDiagnosis('not an object');
      expect(result.valid).toBe(false);
    });
  });
});
