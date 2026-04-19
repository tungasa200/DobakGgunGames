# 이메일 서비스 전환: SMTP → Resend

**작업일**: 2026-04-20
**작업자**: tungasa200

---

## 배경 / 원인

프로덕션 서버(`api.dobakggun.kr`)에서 `POST /api/auth/send-email-code` 요청 시 503 오류 발생.

```
httpStatus: 503
totalDuration: 5371ms
```

`application.properties`의 SMTP `connectiontimeout=5000ms`와 응답 시간(5.37초)이 일치 →
TCP 연결 자체가 실패하는 것으로 진단.

**근본 원인**: Railway 서버에서 아웃바운드 SMTP 포트(587)가 차단됨.
클라우드 플랫폼은 스팸 방지 목적으로 SMTP 포트를 기본 차단함.
인증 실패였다면 연결 후 즉시 실패하지만, 5초 타임아웃 후 실패한다는 점에서
연결 자체가 안 되는 포트 차단임을 확인.

---

## 해결 방안

SMTP(포트 587) 대신 **HTTP API 기반 이메일 서비스(Resend)** 로 전환.
HTTP(포트 443)는 어떤 클라우드 플랫폼에서도 차단되지 않음.

---

## 수정 내용

### 1. `backend/build.gradle`

```diff
- implementation 'org.springframework.boot:spring-boot-starter-mail'
+ implementation 'com.resend:resend-java:3.1.0'
```

### 2. `backend/src/main/resources/application.properties`

```diff
- # 이메일 인증
- spring.mail.host=smtp.gmail.com
- spring.mail.port=587
- spring.mail.username=${MAIL_USERNAME:}
- spring.mail.password=${MAIL_PASSWORD:}
- spring.mail.properties.mail.smtp.auth=true
- spring.mail.properties.mail.smtp.starttls.enable=true
- spring.mail.properties.mail.smtp.connectiontimeout=5000
- spring.mail.properties.mail.smtp.timeout=5000
- spring.mail.properties.mail.smtp.writetimeout=5000
- app.mail.verification-token-expiry=86400
- app.mail.base-url=${APP_BASE_URL:http://localhost:5173}
+ # 이메일 인증 (Resend)
+ resend.api-key=${RESEND_API_KEY:}
+ app.mail.from=${MAIL_FROM:noreply@dobakggun.kr}
+ app.mail.verification-token-expiry=86400
+ app.mail.base-url=${APP_BASE_URL:http://localhost:5173}
```

### 3. `backend/src/main/java/com/dobakggun/service/EmailService.java`

`JavaMailSender` / `MimeMessageHelper` 제거, Resend SDK(`CreateEmailOptions`) 로 교체.
발송 로직(`send()`)은 동일하게 예외 시 `RuntimeException("이메일 발송 실패: ...")` 래핑 유지
→ `GlobalExceptionHandler`의 503 처리 흐름 그대로 동작.

---

## 배포 시 필요한 환경변수 변경

| 항목 | 기존 | 변경 |
|------|------|------|
| `MAIL_USERNAME` | Gmail 주소 | **삭제** |
| `MAIL_PASSWORD` | Gmail 앱 비밀번호 | **삭제** |
| `RESEND_API_KEY` | (없음) | **추가** — Resend 대시보드에서 발급 |
| `MAIL_FROM` | (없음) | **추가** — `noreply@dobakggun.kr` (도메인 인증 후) |

### Resend 세팅 순서
1. [resend.com](https://resend.com) 가입 → API Keys → 새 키 발급
2. Domains → `dobakggun.kr` 추가 → DNS TXT/MX 레코드 등록 → 인증 대기
3. Railway 환경변수에 `RESEND_API_KEY`, `MAIL_FROM` 추가
4. 기존 `MAIL_USERNAME`, `MAIL_PASSWORD` 삭제

> **도메인 인증 전 테스트**: `MAIL_FROM=onboarding@resend.dev` 로 임시 설정하면 본인 계정으로 발송 테스트 가능 (Resend 무료 플랜 기본 제공)

---

## 수정 파일 목록

- `backend/build.gradle`
- `backend/src/main/resources/application.properties`
- `backend/src/main/java/com/dobakggun/service/EmailService.java`
