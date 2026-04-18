package com.dobakggun.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@Service
public class ProfanityService {

    private final List<String> badwords;

    public ProfanityService(ObjectMapper objectMapper) throws IOException {
        ClassPathResource resource = new ClassPathResource("badwords.json");
        Map<String, List<String>> data = objectMapper.readValue(
                resource.getInputStream(),
                new TypeReference<>() {}
        );
        this.badwords = data.get("badwords");
    }

    public boolean containsProfanity(String text) {
        String normalized = text.replaceAll("\\s+", "").toLowerCase();
        return badwords.stream().anyMatch(word -> normalized.contains(word.toLowerCase()));
    }
}
