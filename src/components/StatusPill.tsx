import type { HealthState } from '../hooks/useApi';

export function StatusPill({ state, onRetry }: { state: HealthState; onRetry: () => void }) {
  if (state.status === 'checking') {
    return (
      <span className="status status--checking" role="status">
        <span className="status__dot" aria-hidden />
        {state.slow ? 'Waking backend… (Render cold start, up to ~60 s)' : 'Checking backend…'}
      </span>
    );
  }
  if (state.status === 'online') {
    return (
      <span className="status status--online" role="status" title={`Checked ${state.checkedAt.toLocaleTimeString('en-GB')}`}>
        <span className="status__dot" aria-hidden />
        <span className="status__icon" aria-hidden>✓</span>
        API online · {state.latencyMs} ms
      </span>
    );
  }
  return (
    <span className="status status--offline" role="alert" title={state.message}>
      <span className="status__dot" aria-hidden />
      <span className="status__icon" aria-hidden>!</span>
      API unreachable
      <button type="button" className="link-button" onClick={onRetry}>
        Retry
      </button>
    </span>
  );
}
