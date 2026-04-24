import type { PostType } from '../../api/boardApi';
import s from './PostTypeBadge.module.css';

interface Props {
  postType: PostType;
  style?: React.CSSProperties;
}

export default function PostTypeBadge({ postType, style }: Props) {
  const label: Record<PostType, string> = {
    TOURNAMENT: '대회기록',
    NOTICE: '공지',
    FREE: '자유',
  };

  return (
    <span className={`${s.badge} ${s[postType]}`} style={style}>
      {label[postType]}
    </span>
  );
}
