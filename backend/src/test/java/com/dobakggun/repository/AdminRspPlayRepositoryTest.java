package com.dobakggun.repository;

import com.dobakggun.entity.AdminRspPlay;
import com.dobakggun.entity.RspChoice;
import com.dobakggun.entity.RspResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * aggregateStatsByAdminUserId 가 실제 DB에서 올바른 형태로 결과를 반환하는지 검증.
 * 과거에 Object[] 반환 타입이 List<Object[]>로 감싸져 들어오는 버그가 있었음 → 500 유발.
 */
@DataJpaTest(excludeAutoConfiguration = {
        org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration.class,
        org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration.class
})
@AutoConfigureTestDatabase
class AdminRspPlayRepositoryTest {

    @Autowired
    AdminRspPlayRepository repo;

    @Test
    @DisplayName("빈 데이터: 집계 결과는 1행, [0, null, null, null]")
    void empty() {
        List<Object[]> rows = repo.aggregateStatsByAdminUserId(42L);

        assertThat(rows).hasSize(1);
        Object[] row = rows.get(0);
        assertThat(row).hasSize(4);
        assertThat(((Number) row[0]).longValue()).isZero();
        assertThat(row[1]).isNull();
        assertThat(row[2]).isNull();
        assertThat(row[3]).isNull();
    }

    @Test
    @DisplayName("WIN/LOSS/DRAW 집계가 올바르게 분류된다")
    void withData() {
        save(1L, RspResult.WIN);
        save(1L, RspResult.WIN);
        save(1L, RspResult.LOSS);
        save(1L, RspResult.DRAW);
        save(2L, RspResult.WIN); // 다른 admin — 집계에 포함되면 안 됨

        List<Object[]> rows = repo.aggregateStatsByAdminUserId(1L);
        Object[] row = rows.get(0);

        assertThat(((Number) row[0]).longValue()).isEqualTo(4L); // total
        assertThat(((Number) row[1]).longValue()).isEqualTo(2L); // wins
        assertThat(((Number) row[2]).longValue()).isEqualTo(1L); // losses
        assertThat(((Number) row[3]).longValue()).isEqualTo(1L); // draws
    }

    private void save(long adminUserId, RspResult result) {
        repo.save(AdminRspPlay.builder()
                .adminUserId(adminUserId)
                .userChoice(RspChoice.ROCK)
                .computerChoice(RspChoice.SCISSORS)
                .result(result)
                .build());
    }
}
