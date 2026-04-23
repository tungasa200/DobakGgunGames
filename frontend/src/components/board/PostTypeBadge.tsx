import type { PostType } from '../../api/boardApi';

interface Props {
  postType: PostType;
  style?: React.CSSProperties;
}

const CONFIG: Record<PostType, { bg: string; color: string; label: string }> = {
  TOURNAMENT: { bg: '#fef3c7', color: '#92400e', label: '대회기록' },
  NOTICE:     { bg: '#fee2e2', color: '#991b1b', label: '공지' },
  FREE:       { bg: '#dbeafe', color: '#1e40af', label: '자유' },
};

export default function PostTypeBadge({ postType, style }: Props) {
  const { bg, color, label } = CONFIG[postType];
  return (
    <span
      style={{
        background: bg,
        color,
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 12,
        fontWeight: 600,
        display: 'inline-block',
        pointerEvents: 'none',
        userSelect: 'none',
        ...style,
      }}
    >
      {label}
    </span>
  );
}
