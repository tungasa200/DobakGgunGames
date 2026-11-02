package com.dobakggun.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

// CORS 설정은 SecurityConfig.corsConfigurationSource() 로 통합됨
@Configuration
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

    private final GameStartInterceptor gameStartInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(gameStartInterceptor).addPathPatterns("/api/*/session/start");
    }
}
