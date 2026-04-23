package com.dobakggun;

import com.dobakggun.service.ChatRedisService;
import com.dobakggun.service.IpBanService;
import com.dobakggun.service.RedisTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * 애플리케이션 컨텍스트 로드 테스트.
 *
 * 로컬 환경에는 Redis가 없으므로,
 * StringRedisTemplate 및 Redis에 직접 의존하는 서비스를 @MockBean으로 대체하여
 * 컨텍스트 로드가 Redis 연결 없이도 성공하도록 합니다.
 */
@SpringBootTest
class DobakGgunGamesApplicationTests {

	/**
	 * StringRedisTemplate 자체를 mock 처리 — 이것만으로 자동 설정 시
	 * Lettuce 커넥션 시도를 우회할 수 없으므로 서비스 레벨도 함께 mock.
	 */
	@MockBean
	private StringRedisTemplate stringRedisTemplate;

	/** @PostConstruct 에서 Redis를 호출하므로 mock 필수 */
	@MockBean
	private IpBanService ipBanService;

	/** StringRedisTemplate 주입 받는 서비스 mock */
	@MockBean
	private RedisTokenService redisTokenService;

	/** 채팅 Redis 서비스 mock */
	@MockBean
	private ChatRedisService chatRedisService;

	@Test
	void contextLoads() {
	}

}
