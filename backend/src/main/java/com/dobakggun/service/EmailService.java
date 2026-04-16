package com.dobakggun.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.mail.base-url}")
    private String baseUrl;

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
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(html, true);
            mailSender.send(message);
        } catch (MessagingException e) {
            throw new RuntimeException("이메일 발송 실패: " + e.getMessage(), e);
        }
    }
}
