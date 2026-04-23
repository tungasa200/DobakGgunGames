import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { chatApi, ChatApiError } from '../../api/chat';
import styles from './CreateRoomForm.module.css';

interface CreateRoomFormProps {
  onSuccess: (roomId: string) => void;
  onCancel: () => void;
}

const ERROR_MAP: Record<string, string> = {
  ROOM_NAME_REQUIRED: '방 이름을 입력해주세요.',
  ROOM_NAME_TOO_LONG: '방 이름은 30자를 넘을 수 없습니다.',
  ROOM_NAME_INVALID: '사용할 수 없는 단어가 포함되어 있습니다.',
  ROOM_LIMIT_EXCEEDED: '채팅방이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  REDIS_UNAVAILABLE: '일시적인 오류입니다. 잠시 후 다시 시도해주세요.',
};

export default function CreateRoomForm({ onSuccess, onCancel }: CreateRoomFormProps) {
  const { accessToken } = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('방 이름을 입력해주세요.');
      return;
    }
    if (trimmed.length > 30) {
      setError('방 이름은 30자를 넘을 수 없습니다.');
      return;
    }
    if (!accessToken) return;

    setIsSubmitting(true);
    setError('');
    try {
      const res = await chatApi.createRoom(accessToken, { name: trimmed });
      onSuccess(res.roomId);
    } catch (err) {
      if (err instanceof ChatApiError) {
        setError(ERROR_MAP[err.code] ?? '방을 만드는 중 오류가 발생했습니다.');
      } else {
        setError('방을 만드는 중 오류가 발생했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={styles.createForm} onSubmit={handleSubmit}>
      <div className={styles.formRow}>
        <input
          ref={inputRef}
          type="text"
          className={`${styles.nameInput} ${error ? styles.nameInputError : ''}`}
          placeholder="방 이름을 입력하세요 (최대 30자)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          disabled={isSubmitting}
          aria-label="방 이름"
          aria-describedby={error ? 'roomNameError' : undefined}
        />
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={isSubmitting || name.trim() === ''}
        >
          {isSubmitting ? '만드는 중...' : '방 만들기'}
        </button>
      </div>
      <div className={styles.formFooter}>
        {error && (
          <span id="roomNameError" className={styles.fieldError} role="alert">
            {error}
          </span>
        )}
        <span className={`${styles.charCount} ${name.length > 28 ? styles.charCountWarn : ''}`}>
          {name.length} / 30
        </span>
        <button type="button" className={styles.cancelLink} onClick={onCancel}>
          ✕ 취소
        </button>
      </div>
    </form>
  );
}
