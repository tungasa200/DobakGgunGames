package com.dobakggun.service;

import com.dobakggun.entity.IpBan;
import com.dobakggun.repository.IpBanRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
public class IpBanService {

    private static final String IP_BAN_SET_KEY = "ip_ban_set";

    private final IpBanRepository ipBanRepository;
    private final StringRedisTemplate redisTemplate;

    // 서버 기동 시 DB → Redis 동기화
    @PostConstruct
    public void syncToRedis() {
        redisTemplate.delete(IP_BAN_SET_KEY);
        List<IpBan> bans = ipBanRepository.findAll();
        if (!bans.isEmpty()) {
            String[] ips = bans.stream().map(IpBan::getIp).toArray(String[]::new);
            redisTemplate.opsForSet().add(IP_BAN_SET_KEY, ips);
        }
    }

    public boolean isBanned(String ip) {
        return Boolean.TRUE.equals(redisTemplate.opsForSet().isMember(IP_BAN_SET_KEY, ip));
    }

    public List<IpBan> getAll() {
        return ipBanRepository.findAllByOrderByBannedAtDesc();
    }

    @Transactional
    public IpBan ban(String ip, String reason, Long adminId) {
        if (ipBanRepository.existsByIp(ip)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 차단된 IP입니다: " + ip);
        }
        IpBan ban = IpBan.builder()
                .ip(ip)
                .reason(reason)
                .bannedBy(adminId)
                .build();
        IpBan saved = ipBanRepository.save(ban);
        redisTemplate.opsForSet().add(IP_BAN_SET_KEY, ip);
        return saved;
    }

    @Transactional
    public void unban(Long id) {
        IpBan ban = ipBanRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "차단 기록을 찾을 수 없습니다"));
        ipBanRepository.delete(ban);
        redisTemplate.opsForSet().remove(IP_BAN_SET_KEY, ban.getIp());
    }
}
