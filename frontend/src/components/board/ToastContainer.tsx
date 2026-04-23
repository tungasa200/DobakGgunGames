import type { Toast } from '../../hooks/useToast';

interface Props {
  toasts: Toast[];
  onRemove: (id: number) => void;
}

export default function ToastContainer({ toasts, onRemove }: Props) {
  if (toasts.length === 0) return null;
  return (
    <div
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8,
        maxWidth: 360,
      }}
    >
      {toasts.map(t => (
        <div
          key={t.id}
          onClick={() => onRemove(t.id)}
          style={{
            background: t.type === 'error' ? '#ef4444' : '#2c3e50',
            color: 'white',
            borderRadius: 8,
            padding: '12px 16px',
            fontSize: 14,
            lineHeight: 1.5,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
