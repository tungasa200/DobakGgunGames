package com.dobakggun.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class BadWordFilter {

    private final ObjectMapper objectMapper;
    private List<String> badWords = new ArrayList<>();

    @PostConstruct
    public void init() {
        try {
            ClassPathResource resource = new ClassPathResource("badwords.json");
            JsonNode root = objectMapper.readTree(resource.getInputStream());
            JsonNode array = root.get("badwords");
            if (array != null && array.isArray()) {
                for (JsonNode node : array) {
                    badWords.add(node.asText().toLowerCase());
                }
            }
            log.info("BadWordFilter: {}개 금칙어 로드 완료", badWords.size());
        } catch (IOException e) {
            log.warn("BadWordFilter: badwords.json 로드 실패 — 금칙어 필터 비활성화됨", e);
        }
    }

    public boolean containsBadWord(String text) {
        if (text == null || badWords.isEmpty()) {
            return false;
        }
        String lower = text.toLowerCase();
        for (String word : badWords) {
            if (lower.contains(word)) {
                return true;
            }
        }
        return false;
    }
}
