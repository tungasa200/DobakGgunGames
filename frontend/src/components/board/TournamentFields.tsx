import GameDifficultyPicker from './GameDifficultyPicker';
import s from './TournamentFields.module.css';

export interface TournamentFormData {
  tournamentDate: string;
  gameKey: string;
  difficultyKey: string;
  winner: string;
  runnerUp: string;
  ranking: string;
  participantCount: string;
  participants: string;
  prize: string;
  sponsor: string;
}

interface Errors {
  tournamentDate?: string;
  gameKey?: string;
  difficultyKey?: string;
  winner?: string;
}

interface Props {
  data: TournamentFormData;
  errors: Errors;
  onChange: (data: TournamentFormData) => void;
}

export default function TournamentFields({ data, errors, onChange }: Props) {
  function set(field: keyof TournamentFormData, value: string) {
    onChange({ ...data, [field]: value });
  }

  return (
    <div className={s.wrap}>
      {/* 필수 영역 */}
      <div className={s.section}>
        <div className={s.row2}>
          <div className={s.fieldGroup}>
            <label className={s.label}>대회 날짜 <span className={s.req}>*</span></label>
            <input
              type="date"
              className={`${s.input} ${errors.tournamentDate ? s.inputError : ''}`}
              value={data.tournamentDate}
              onChange={e => set('tournamentDate', e.target.value)}
            />
            {errors.tournamentDate && <p className={s.errorMsg}>{errors.tournamentDate}</p>}
          </div>

          <GameDifficultyPicker
            gameKey={data.gameKey}
            difficultyKey={data.difficultyKey}
            onGameChange={v => onChange({ ...data, gameKey: v, difficultyKey: '' })}
            onDifficultyChange={v => set('difficultyKey', v)}
            gameError={errors.gameKey}
            difficultyError={errors.difficultyKey}
          />
        </div>

        <div className={s.fieldGroup}>
          <label className={s.label}>우승자 <span className={s.req}>*</span></label>
          <input
            type="text"
            className={`${s.input} ${errors.winner ? s.inputError : ''}`}
            value={data.winner}
            onChange={e => set('winner', e.target.value)}
            maxLength={50}
            placeholder="우승자 이름"
          />
          {errors.winner && <p className={s.errorMsg}>{errors.winner}</p>}
        </div>
      </div>

      {/* 구분선 */}
      <hr className={s.divider} />

      {/* 선택 영역 */}
      <div className={s.section}>
        <div className={s.fieldGroup}>
          <label className={s.label}>준우승자</label>
          <input
            type="text"
            className={s.input}
            value={data.runnerUp}
            onChange={e => set('runnerUp', e.target.value)}
            maxLength={50}
            placeholder="준우승자 이름 (선택)"
          />
        </div>

        <div className={s.fieldGroup}>
          <label className={s.label}>순위</label>
          <textarea
            className={`${s.input} ${s.textarea}`}
            value={data.ranking}
            onChange={e => set('ranking', e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="예: 1위: A / 2위: B / 3위: C (선택)"
          />
        </div>

        <div className={s.row2}>
          <div className={s.fieldGroup}>
            <label className={s.label}>참가인원수</label>
            <input
              type="number"
              className={s.input}
              value={data.participantCount}
              onChange={e => set('participantCount', e.target.value)}
              min={1}
              max={999}
              placeholder="예: 8 (선택)"
            />
          </div>
          <div className={s.fieldGroup}>
            <label className={s.label}>참가자 명단</label>
            <input
              type="text"
              className={s.input}
              value={data.participants}
              onChange={e => set('participants', e.target.value)}
              maxLength={1000}
              placeholder="콤마로 구분 (선택)"
            />
          </div>
        </div>

        <div className={s.fieldGroup}>
          <label className={s.label}>상품</label>
          <input
            type="text"
            className={s.input}
            value={data.prize}
            onChange={e => set('prize', e.target.value)}
            maxLength={500}
            placeholder="예: 스타벅스 기프티콘 (선택)"
          />
        </div>

        <div className={s.fieldGroup}>
          <label className={s.label}>스폰서</label>
          <input
            type="text"
            className={s.input}
            value={data.sponsor}
            onChange={e => set('sponsor', e.target.value)}
            maxLength={200}
            placeholder="예: 도박군 프로젝트 (선택)"
          />
        </div>
      </div>
    </div>
  );
}
