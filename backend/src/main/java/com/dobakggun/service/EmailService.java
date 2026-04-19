package com.dobakggun.service;

import com.resend.Resend;
import com.resend.services.emails.model.CreateEmailOptions;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class EmailService {

    private final Resend resend;

    @Value("${app.mail.from}")
    private String from;

    @Value("${app.mail.base-url}")
    private String baseUrl;

    public EmailService(@Value("${resend.api-key}") String apiKey) {
        this.resend = new Resend(apiKey);
    }

    public void sendVerificationEmail(String to, String token) {
        String link = baseUrl + "/verify-email?token=" + token;
        String html = "<h2>도박꾼게임즈 이메일 인증</h2>"
                + "<p>아래 버튼을 클릭해 이메일을 인증해 주세요. (24시간 유효)</p>"
                + "<a href=\"" + link + "\" style=\""
                + "display:inline-block;padding:12px 24px;background:#4f46e5;"
                + "color:#fff;border-radius:6px;text-decoration:none;font-weight:bold\">"
                + "이메일 인증하기</a>";
        send(to, "[도박꾼게임즈] 이메일 인증", html);
    }

    public void sendEmailOtp(String to, String code) {
        String html = "<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto\">"
                + "<h2 style=\"color:#111\">도박꾼게임즈 이메일 인증</h2>"
                + "<p style=\"color:#444\">아래 6자리 인증 코드를 입력해 주세요.</p>"
                + "<div style=\"font-size:36px;font-weight:bold;letter-spacing:10px;"
                + "text-align:center;padding:24px 0;background:#f3f4f6;"
                + "border-radius:10px;margin:20px 0;color:#111\">"
                + code + "</div>"
                + "<p style=\"color:#888;font-size:13px\">10분 이내에 입력해 주세요.</p>"
                + "<p style=\"color:#bbb;font-size:12px\">본인이 요청하지 않은 경우 이 메일을 무시해 주세요.</p>"
                + "</div>";
        send(to, "[도박꾼게임즈] 이메일 인증 코드: " + code, html);
    }

    public void sendPasswordResetEmail(String to, String token) {
        String link = baseUrl + "/reset-password?token=" + token;
        String html = "<h2>도박꾼게임즈 비밀번호 재설정</h2>"
                + "<p>아래 버튼을 클릭해 비밀번호를 재설정하세요. (30분 유효)</p>"
                + "<a href=\"" + link + "\" style=\""
                + "display:inline-block;padding:12px 24px;background:#dc2626;"
                + "color:#fff;border-radius:6px;text-decoration:none;font-weight:bold\">"
                + "비밀번호 재설정</a>";
        send(to, "[도박꾼게임즈] 비밀번호 재설정", html);
    }

    private void send(String to, String subject, String html) {
        try {
            CreateEmailOptions params = CreateEmailOptions.builder()
                    .from(from)
                    .to(List.of(to))
                    .subject(subject)
                    .html(html)
                    .build();
            resend.emails().send(params);
        } catch (Exception e) {
            throw new RuntimeException("이메일 발송 실패: " + e.getMessage(), e);
        }
    }
}
