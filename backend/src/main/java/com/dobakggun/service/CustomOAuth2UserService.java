package com.dobakggun.service;

import com.dobakggun.entity.User;
import com.dobakggun.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final UserRepository userRepository;

    @Override
    @Transactional
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oAuth2User = super.loadUser(userRequest);
        String registrationId = userRequest.getClientRegistration().getRegistrationId();

        String email;
        String name;
        String providerId;
        User.Provider provider;

        switch (registrationId) {
            case "google" -> {
                email = oAuth2User.getAttribute("email");
                name = oAuth2User.getAttribute("name");
                providerId = oAuth2User.getAttribute("sub");
                provider = User.Provider.GOOGLE;
            }
            case "kakao" -> {
                Map<String, Object> kakaoAccount = oAuth2User.getAttribute("kakao_account");
                Map<String, Object> profile = kakaoAccount != null
                        ? (Map<String, Object>) kakaoAccount.get("profile") : Collections.emptyMap();
                email = kakaoAccount != null ? (String) kakaoAccount.get("email") : null;
                name = profile != null ? (String) profile.get("nickname") : null;
                providerId = String.valueOf(oAuth2User.getAttribute("id"));
                provider = User.Provider.KAKAO;
            }
            case "naver" -> {
                Map<String, Object> response = oAuth2User.getAttribute("response");
                email = response != null ? (String) response.get("email") : null;
                name = response != null ? (String) response.get("name") : null;
                providerId = response != null ? (String) response.get("id") : null;
                provider = User.Provider.NAVER;
            }
            default -> throw new OAuth2AuthenticationException("지원하지 않는 OAuth2 제공자: " + registrationId);
        }

        if (email == null) {
            throw new OAuth2AuthenticationException("이메일 정보를 가져올 수 없습니다");
        }

        final User.Provider finalProvider = provider;
        final String finalProviderId = providerId;
        final String finalEmail = email;
        final String finalName = name;

        User user = userRepository.findByEmail(finalEmail)
                .map(existing -> {
                    // 같은 이메일로 다른 provider 가입 시 연동 처리
                    if (existing.getProvider() != finalProvider) {
                        existing.setProvider(finalProvider);
                        existing.setProviderId(finalProviderId);
                    }
                    return existing;
                })
                .orElseGet(() -> {
                    // 자동 가입
                    String nickname = generateUniqueNickname(finalName);
                    return userRepository.save(User.builder()
                            .email(finalEmail)
                            .nickname(nickname)
                            .provider(finalProvider)
                            .providerId(finalProviderId)
                            .status(User.Status.ACTIVE)
                            .build());
                });

        return new DefaultOAuth2User(
                Collections.emptyList(),
                Map.of("userId", user.getId(), "email", user.getEmail()),
                "email"
        );
    }

    private String generateUniqueNickname(String base) {
        String candidate = base != null ? base.replaceAll("[^가-힣a-zA-Z0-9_]", "").substring(0, Math.min(base.length(), 10)) : "";
        if (candidate.isEmpty()) candidate = "user";

        String nickname = candidate;
        int attempt = 0;
        while (userRepository.existsByNickname(nickname)) {
            nickname = candidate + UUID.randomUUID().toString().replace("-", "").substring(0, 4);
            if (++attempt > 10) nickname = "user" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        }
        return nickname;
    }
}
