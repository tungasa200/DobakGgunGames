package com.dobakggun.service;

import com.dobakggun.entity.User;
import com.dobakggun.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final UserRepository userRepository;

    public Page<User> getUsers(String search, String roleStr, String statusStr, Pageable pageable) {
        User.Role role = (roleStr != null && !roleStr.isBlank()) ? User.Role.valueOf(roleStr.toUpperCase()) : null;
        User.Status status = (statusStr != null && !statusStr.isBlank()) ? User.Status.valueOf(statusStr.toUpperCase()) : null;
        String searchParam = (search != null && !search.isBlank()) ? search : null;
        return userRepository.findBySearchAndFilters(searchParam, role, status, pageable);
    }

    @Transactional
    public User updateRole(Long targetId, Long adminId, String roleStr) {
        if (targetId.equals(adminId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "자기 자신의 role은 변경할 수 없습니다");
        }
        User user = findOrThrow(targetId);
        user.setRole(User.Role.valueOf(roleStr.toUpperCase()));
        return user;
    }

    @Transactional
    public User updateStatus(Long targetId, Long adminId, String statusStr) {
        if (targetId.equals(adminId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "자기 자신의 status는 변경할 수 없습니다");
        }
        User user = findOrThrow(targetId);
        user.setStatus(User.Status.valueOf(statusStr.toUpperCase()));
        return user;
    }

    @Transactional
    public void deleteUser(Long targetId, Long adminId) {
        if (targetId.equals(adminId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "자기 자신은 탈퇴시킬 수 없습니다");
        }
        if (!userRepository.existsById(targetId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "유저를 찾을 수 없습니다");
        }
        userRepository.deleteById(targetId);
    }

    private User findOrThrow(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "유저를 찾을 수 없습니다"));
    }
}
