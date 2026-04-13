package com.dobakggun.repository;

import com.dobakggun.entity.Ranking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.NoRepositoryBean;

import java.time.LocalDateTime;

@NoRepositoryBean
public interface RankingRepository<T extends Ranking> extends JpaRepository<T, Long> {
    long countByIpHashAndCreatedAtAfter(String ipHash, LocalDateTime after);
}
