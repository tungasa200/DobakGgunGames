package com.dobakggun.config;

import com.dobakggun.security.BlockfallBattleHandshakeInterceptor;
import com.dobakggun.security.JwtHandshakeInterceptor;
import com.dobakggun.security.RpsHandshakeInterceptor;
import com.dobakggun.security.StompChannelInterceptor;
import com.dobakggun.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtUtil jwtUtil;
    private final StompChannelInterceptor stompChannelInterceptor;

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // 기존 /ws 엔드포인트 — 변경 없음 (회귀 방지)
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(allowedOrigins.split(","))
                .addInterceptors(new JwtHandshakeInterceptor(jwtUtil))
                .withSockJS();

        // 신규 /ws-battle 엔드포인트 — JWT 또는 guestToken 허용
        registry.addEndpoint("/ws-battle")
                .setAllowedOriginPatterns(allowedOrigins.split(","))
                .addInterceptors(new BlockfallBattleHandshakeInterceptor(jwtUtil))
                .withSockJS();

        // /ws-rps 엔드포인트 — JWT(로그인) 또는 guestToken(비로그인) 허용
        registry.addEndpoint("/ws-rps")
                .setAllowedOriginPatterns(allowedOrigins.split(","))
                .addInterceptors(new RpsHandshakeInterceptor(jwtUtil))
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue")
                .setHeartbeatValue(new long[]{25000, 25000});
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(stompChannelInterceptor);
    }
}
