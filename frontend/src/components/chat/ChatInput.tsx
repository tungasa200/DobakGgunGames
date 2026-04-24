import { useState, useRef, useEffect } from 'react';
import styles from './ChatInput.module.css';

interface ChatInputProps {
  disabled: boolean;
  onSend: (text: string) => void;
  serverError: string;
}

const MAX_LENGTH = 200;
const MIN_HEIGHT = 44;
const MAX_HEIGHT = 120;

export default function ChatInput({ disabled, onSend, serverError }: ChatInputProps) {
  const [text, setText] = useState('');
  const [localError, setLocalError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 서버 에러 3초 후 자동 소멸 (부모가 빈 문자열로 리셋해야 하지만 표시 시간 제한)
  const [visibleServerError, setVisibleServerError] = useState('');
  useEffect(() => {
    if (!serverError) {
      setVisibleServerError('');
      return;
    }
    setVisibleServerError(serverError);
    const t = setTimeout(() => setVisibleServerError(''), 3000);
    return () => clearTimeout(t);
  }, [serverError]);

  // textarea 자동 높이 조정
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = `${MIN_HEIGHT}px`;
    const scrollH = el.scrollHeight;
    el.style.height = `${Math.min(scrollH, MAX_HEIGHT)}px`;
  }, [text]);

  const handleSend = () => {
    if (disabled) return;
    const trimmed = text.trim();
    if (!trimmed) {
      setLocalError('메시지를 입력해주세요.');
      return;
    }
    setLocalError('');
    onSend(trimmed);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const displayError = visibleServerError || localError;

  return (
    <div className={styles.inputArea}>
      {displayError && (
        <div className={styles.inputError} role="alert">
          {displayError}
        </div>
      )}
      <div className={styles.inputRow}>
        <textarea
          ref={textareaRef}
          className={styles.textInput}
          placeholder={disabled ? '연결 중...' : '메시지를 입력하세요...'}
          value={text}
          onChange={(e) => {
            if (e.target.value.length <= MAX_LENGTH) {
              setText(e.target.value);
              setLocalError('');
            }
          }}
          onKeyDown={handleKeyDown}
          maxLength={MAX_LENGTH}
          disabled={disabled}
          rows={1}
          aria-label="메시지 입력"
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={disabled || text.trim() === ''}
          aria-label="메시지 전송"
        >
          ➤
        </button>
      </div>
      <div className={styles.inputMeta}>
        <span className={`${styles.charCount} ${text.length > 180 ? styles.charCountWarn : ''}`}>
          {text.length} / {MAX_LENGTH}
        </span>
      </div>
    </div>
  );
}
