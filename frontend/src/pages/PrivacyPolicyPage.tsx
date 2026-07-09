import { Link } from 'react-router-dom';
import NormalHeader from '../components/normal/NormalHeader';
import Footer from '../components/normal/Footer';
import styles from './PolicyPage.module.css';

export default function PrivacyPolicyPage() {
  return (
    <div className={styles.wrap}>
      <NormalHeader currentGame="" gameName="개인정보 처리방침" accentColor="#101f38" />
      <div className={styles.content}>
        <h1 className={styles.title}>개인정보 처리방침</h1>
        <p className={styles.updated}>최종 수정일: 2025년 4월 13일</p>

        <section className={styles.section}>
          <h2>1. 수집하는 개인정보 항목</h2>
          <p>DobakGgun(이하 "서비스")은 랭킹 등록 시 다음 정보를 수집합니다.</p>
          <ul>
            <li><strong>IP 주소</strong> — 어뷰징(부정 점수 등록) 방지 목적으로 수집하며, 저장 시 SHA-256 해시로 변환되어 원본 IP는 보관하지 않습니다.</li>
            <li><strong>닉네임</strong> — 랭킹 표시를 위해 사용자가 직접 입력한 이름입니다. 실명 입력을 권장하지 않습니다.</li>
          </ul>
          <p>서비스 이용 시 별도의 회원가입이나 이메일 등 추가 개인정보는 수집하지 않습니다.</p>
        </section>

        <section className={styles.section}>
          <h2>2. 수집 목적</h2>
          <ul>
            <li>랭킹 어뷰징(동일 IP 과다 등록) 방지 및 서비스 공정성 유지</li>
            <li>랭킹 기록 표시 (닉네임)</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>3. 보유 및 이용 기간</h2>
          <p>수집된 정보는 서비스 운영 기간 동안 보관되며, 서비스 종료 시 즉시 파기합니다.</p>
          <p>랭킹 기록은 주간 랭킹 기준으로 매주 초기화되며, 전체 기록은 별도 보관됩니다.</p>
        </section>

        <section className={styles.section}>
          <h2>4. 제3자 제공</h2>
          <p>수집된 정보는 외부에 제공하지 않습니다. 단, 법령에 의한 수사기관 요청이 있는 경우는 예외입니다.</p>
        </section>

        <section className={styles.section}>
          <h2>5. 이용자의 권리</h2>
          <p>본인의 랭킹 기록 삭제 등 개인정보 관련 요청은 아래 이메일로 문의해 주세요.</p>
          <p><strong>문의 이메일:</strong> <a href="mailto:ksoung140w@gmail.com">ksoung140w@gmail.com</a></p>
        </section>

        <section className={styles.section}>
          <h2>6. 쿠키 및 로컬 스토리지</h2>
          <p>서비스는 게임 설정 유지를 위해 브라우저의 로컬 스토리지를 사용할 수 있습니다. 별도의 추적 쿠키나 광고 쿠키는 사용하지 않습니다.</p>
        </section>

        <section className={styles.section}>
          <h2>7. 개인정보 처리방침 변경</h2>
          <p>본 방침은 법령 변경 또는 서비스 정책 변경 시 사전 고지 없이 수정될 수 있으며, 수정 시 최종 수정일을 업데이트합니다.</p>
        </section>

        <div className={styles.backLink}>
          <Link to="/">← 홈으로 돌아가기</Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}
