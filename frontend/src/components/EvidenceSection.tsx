import { Diagnosis } from '../types/diagnosis';
import CommandBlock from './CommandBlock';

interface EvidenceSectionProps {
  diagnosis: Diagnosis;
}

export default function EvidenceSection({ diagnosis }: EvidenceSectionProps) {
  return (
    <div>
      {/* Evidence */}
      {diagnosis.evidence.length > 0 && (
        <div className="section">
          <div className="section-title">Evidence</div>
          <div className="evidence-list">
            {diagnosis.evidence.map((e, i) => (
              <div key={i} className="evidence-item">
                <span className="evidence-num">{String(i + 1).padStart(2, '0')}</span>
                <span style={{ flex: 1 }}>{e.fact}</span>
                <span className={`evidence-importance ${e.importance}`}>{e.importance}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Possible Causes */}
      {diagnosis.possibleCauses.length > 0 && (
        <div className="section">
          <div className="section-title">Possible Causes</div>
          <div className="evidence-list">
            {diagnosis.possibleCauses.map((c, i) => (
              <div key={i} className="evidence-item">
                <span className={`evidence-importance ${c.likelihood}`}>{c.likelihood}</span>
                <span>{c.cause}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Solution */}
      {diagnosis.solution && (
        <div className="section">
          <div className="section-title">Recommended Solution</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
            {diagnosis.solution.explanation}
          </div>
          {diagnosis.solution.steps.length > 0 && (
            <ol style={{ paddingLeft: 18, fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.8 }}>
              {diagnosis.solution.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* Verification Commands */}
      {diagnosis.verificationCommands.length > 0 && (
        <div className="section">
          <div className="section-title">Verification</div>
          {diagnosis.verificationCommands.map((cmd, i) => (
            <CommandBlock key={i} command={cmd.command} purpose={cmd.purpose} />
          ))}
        </div>
      )}

      {/* Remediation Commands */}
      {diagnosis.remediationCommands.length > 0 && (
        <div className="section">
          <div className="section-title">Remediation</div>
          {diagnosis.remediationCommands.map((cmd, i) => (
            <CommandBlock key={i} command={cmd.command} purpose={cmd.purpose} risk={cmd.risk} />
          ))}
        </div>
      )}

      {/* Warnings */}
      {diagnosis.warnings.length > 0 && (
        <div className="section">
          <div className="section-title">Warnings</div>
          {diagnosis.warnings.map((w, i) => (
            <div key={i} className="warning-box">
              <span className="warning-box-icon">⚠</span>
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Additional Investigation */}
      {diagnosis.additionalInvestigation.length > 0 && (
        <div className="section">
          <div className="section-title">Additional Investigation</div>
          <ul style={{ paddingLeft: 16, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            {diagnosis.additionalInvestigation.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
