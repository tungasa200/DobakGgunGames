package com.dobakggun.repository;

import com.dobakggun.entity.AdminRspPlay;
import com.dobakggun.entity.RspResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AdminRspPlayRepository extends JpaRepository<AdminRspPlay, Long> {

    long countByAdminUserId(Long adminUserId);

    long countByAdminUserIdAndResult(Long adminUserId, RspResult result);

    /**
     * 어드민 본인 통계를 한 번의 쿼리로 집계.
     * result[0] = totalPlays, result[1] = wins, result[2] = losses, result[3] = draws
     */
    @Query("""
        SELECT
            COUNT(p),
            SUM(CASE WHEN p.result = 'WIN'  THEN 1 ELSE 0 END),
            SUM(CASE WHEN p.result = 'LOSS' THEN 1 ELSE 0 END),
            SUM(CASE WHEN p.result = 'DRAW' THEN 1 ELSE 0 END)
        FROM AdminRspPlay p
        WHERE p.adminUserId = :adminUserId
    """)
    Object[] aggregateStatsByAdminUserId(@Param("adminUserId") Long adminUserId);
}
