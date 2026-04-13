import { Link } from 'react-router-dom';
import NormalHeader from '../components/normal/NormalHeader';
import Footer from '../components/normal/Footer';
import styles from './PolicyPage.module.css';

export default function TermsOfServicePage() {
  return (
    <div className={styles.wrap}>
      <NormalHeader currentGame="" gameName="이용약관" accentColor="#2c3e50" />
      <div className={styles.content}>
        <h1 className={styles.title}>이용약관</h1>
        <p className={styles.updated}>최종 수정일: 2025년 4월 13일</p>

        <section className={styles.section}>
          <h2>제1조 (목적)</h2>
          <p>본 약관은 DobakGgun(이하 "서비스")이 제공하는 웹 게임 서비스의 이용 조건 및 절차, 이용자와 서비스 운영자 간의 권리·의무 관계를 규정함을 목적으로 합니다.</p>
        </section>

        <section className={styles.section}>
          <h2>제2조 (서비스 이용)</h2>
          <ul>
            <li>서비스는 별도의 회원가입 없이 누구나 무료로 이용할 수 있습니다.</li>
            <li>랭킹 등록 시 닉네임을 입력해야 하며, 타인을 사칭하거나 비방하는 닉네임은 사용할 수 없습니다.</li>
            <li>서비스는 이용자의 서비스 이용을 제한할 수 있으며, 부정 행위(핵, 매크로 등)가 확인된 경우 해당 기록을 삭제할 수 있습니다.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>제3조 (금지 행위)</h2>
          <p>이용자는 다음 행위를 해서는 안 됩니다.</p>
          <ul>
            <li>프로그램 조작, 자동화 도구(매크로, 봇 등)를 이용한 점수 조작</li>
            <li>서비스의 정상적인 운영을 방해하는 행위 (DDoS 등)</li>
            <li>욕설·비방·혐오 표현이 포함된 닉네임 등록</li>
            <li>타인의 개인정보를 도용하거나 사칭하는 행위</li>
            <li>기타 법령 또는 공공질서에 반하는 행위</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>제4조 (서비스 제공 및 변경)</h2>
          <ul>
            <li>서비스는 연중무휴 제공을 원칙으로 하나, 시스템 점검·장애·기타 사유로 일시 중단될 수 있습니다.</li>
            <li>운영자는 서비스의 내용을 사전 고지 없이 변경하거나 종료할 수 있습니다.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>제5조 (면책 조항)</h2>
          <ul>
            <li>서비스는 이용자가 서비스를 통해 기대하는 결과를 보증하지 않습니다.</li>
            <li>이용자 간 또는 이용자와 제3자 간의 분쟁에 대해 서비스는 책임을 지지 않습니다.</li>
            <li>천재지변, 서버 장애 등 불가항력으로 인한 서비스 중단에 대해 책임을 지지 않습니다.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>제6조 (개인정보)</h2>
          <p>이용자의 개인정보 처리에 관한 사항은 <Link to="/privacy">개인정보 처리방침</Link>을 따릅니다.</p>
        </section>

        <section className={styles.section}>
          <h2>제7조 (문의)</h2>
          <p>서비스 이용 관련 문의는 아래 이메일로 연락해 주세요.</p>
          <p><strong>이메일:</strong> <a href="mailto:ksoung140w@gmail.com">ksoung140w@gmail.com</a></p>
        </section>

        <div className={styles.backLink}>
          <Link to="/">← 홈으로 돌아가기</Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}
