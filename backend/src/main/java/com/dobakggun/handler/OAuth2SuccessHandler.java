package com.dobakggun.handler;

import com.dobakggun.dto.auth.AuthResponse;
import com.dobakggun.entity.User;
import com.dobakggun.repository.UserRepository;
import com.dobakggun.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final AuthService authService;
    private final UserRepository userRepository;

    @Value("${app.mail.base-url}")
    private String baseUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();
        Long userId = (Long) oAuth2User.getAttribute("userId");

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다"));

        AuthResponse tokens = authService.issueTokens(user);

        // AT를 URL 파라미터로 전달, RT는 별도 httpOnly cookie 설정 (프론트에서 처리)
        String redirectUrl = baseUrl + "/oauth/callback"
                + "?accessToken=" + tokens.getAccessToken()
                + "&refreshToken=" + tokens.getRefreshToken();

        getRedirectStrategy().sendRedirect(request, response, redirectUrl);
    }
}
