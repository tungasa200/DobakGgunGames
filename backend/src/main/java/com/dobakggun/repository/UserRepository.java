package com.dobakggun.repository;

import com.dobakggun.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    Optional<User> findByNickname(String nickname);
    boolean existsByEmail(String email);
    boolean existsByNickname(String nickname);
    Optional<User> findByProviderAndProviderId(User.Provider provider, String providerId);

    // 어드민 — 이메일/닉네임 검색
    @Query("SELECT u FROM User u WHERE " +
           "(:search IS NULL OR LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(u.nickname) LIKE LOWER(CONCAT('%', :search, '%'))) " +
           "AND (:role IS NULL OR u.role = :role) " +
           "AND (:status IS NULL OR u.status = :status)")
    Page<User> findBySearchAndFilters(
            @Param("search") String search,
            @Param("role") User.Role role,
            @Param("status") User.Status status,
            Pageable pageable
    );

    long countByStatus(User.Status status);
    long countByRole(User.Role role);
}
