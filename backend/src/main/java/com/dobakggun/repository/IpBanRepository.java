package com.dobakggun.repository;

import com.dobakggun.entity.IpBan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface IpBanRepository extends JpaRepository<IpBan, Long> {
    boolean existsByIp(String ip);
    Optional<IpBan> findByIp(String ip);
    List<IpBan> findAllByOrderByBannedAtDesc();
}
