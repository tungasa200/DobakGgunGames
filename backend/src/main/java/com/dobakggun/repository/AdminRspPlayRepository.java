package com.dobakggun.repository;

import com.dobakggun.entity.AdminRspPlay;
import com.dobakggun.entity.RspResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AdminRspPlayRepository extends JpaRepository<AdminRspPlay, Long> {

    long countByAdminUserId(Long adminUserId);

    long countByAdminUserIdAndResult(Long adminUserId, RspResult result);

    /**
     * 어드민 본인 통계를 한 번의 쿼리로 집계.
     * 결과는 항상 1행: row[0] = totalPlays, row[1] = wins, row[2] = losses, row[3] = draws
     *
     * NOTE: Spring Data JPA에서 멀티 컬럼 집계를 `Object[]`로 선언하면 `List<Object[]>`가
     *       외부 `Object[]`로 감싸져 들어와 `row[0]`이 실제 Long이 아닌 내부 행 배열이 된다.
     *       반드시 `List<Object[]>`로 받고 호출측에서 `get(0)`으로 언래핑할 것.
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
    List<Object[]> aggregateStatsByAdminUserId(@Param("adminUserId") Long adminUserId);
}
