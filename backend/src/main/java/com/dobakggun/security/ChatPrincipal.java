package com.dobakggun.security;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.security.Principal;

@Getter
@RequiredArgsConstructor
public class ChatPrincipal implements Principal {

    private final Long userId;
    private final String nickname;
    private final String role;

    @Override
    public String getName() {
        return String.valueOf(userId);
    }
}
