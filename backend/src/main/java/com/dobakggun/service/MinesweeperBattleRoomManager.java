package com.dobakggun.service;

import com.dobakggun.domain.minesweeper.MinesweeperBattleRoom;
import com.dobakggun.domain.minesweeper.MinesweeperBattleRoom.PlayerInfo;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

/**
 * 지뢰찾기 배틀 인메모리 방 상태 관리 컴포넌트.
 * <p>
 * 1P vs 2P 고정 — 방 하나에 최대 2명.
 * BattleRoomManager(Blockfall) 와 완전히 별개의 자료구조.
 */
@Slf4j
@Component
public class MinesweeperBattleRoomManager {

    // ─── 인메모리 저장소 ──────────────────────────────────────────────────────

    /** roomId → MinesweeperBattleRoom */
    private final ConcurrentHashMap<String, MinesweeperBattleRoom> rooms = new ConcurrentHashMap<>();

    /** playerId → roomId (빠른 역방향 조회) */
    private final ConcurrentHashMap<String, String> playerToRoom = new ConcurrentHashMap<>();

    /** sessionId → roomId (SessionDisconnectEvent 에서 빠른 조회) */
    private final ConcurrentHashMap<String, String> sessionToRoom = new ConcurrentHashMap<>();

    /** roomId → ReentrantLock (방별 동시성 제어) */
    private final ConcurrentHashMap<String, ReentrantLock> roomLocks = new ConcurrentHashMap<>();

    // ─── 방 생명주기 ──────────────────────────────────────────────────────────

    /**
     * 새 방을 생성하고 저장한다.
     * roomId 는 호출자(Service)가 결정하여 전달.
     */
    public MinesweeperBattleRoom createRoom(String roomId) {
        MinesweeperBattleRoom room = new MinesweeperBattleRoom(roomId);
        rooms.put(roomId, room);
        roomLocks.put(roomId, new ReentrantLock(true));
        log.debug("MinesweeperRoomManager.createRoom: roomId={}", roomId);
        return room;
    }

    /** roomId 로 방 조회 */
    public Optional<MinesweeperBattleRoom> getRoom(String roomId) {
        return Optional.ofNullable(rooms.get(roomId));
    }

    /**
     * WAITING 상태이고 플레이어가 1명인 방을 찾는다.
     * 2번째 플레이어 매칭 시 사용.
     */
    public Optional<MinesweeperBattleRoom> findWaitingRoom() {
        return rooms.values().stream()
                .filter(r -> r.getStatus() == MinesweeperBattleRoom.Status.WAITING
                        && r.getPlayerCount() == 1)
                .findFirst();
    }

    /**
     * 방을 제거하고 관련 인덱스를 정리한다.
     * 방에 남아있는 플레이어/세션 매핑도 함께 제거.
     */
    public void closeRoom(String roomId) {
        MinesweeperBattleRoom room = rooms.remove(roomId);
        roomLocks.remove(roomId);

        if (room != null) {
            room.getPlayers().forEach(p -> {
                playerToRoom.remove(p.getPlayerId());
                if (p.getSessionId() != null) {
                    sessionToRoom.remove(p.getSessionId());
                }
            });
        }
        log.debug("MinesweeperRoomManager.closeRoom: roomId={}", roomId);
    }

    // ─── 플레이어 참가 ────────────────────────────────────────────────────────

    /**
     * 플레이어를 방에 추가한다.
     * 방별 ReentrantLock 으로 race condition 방지 (2명이 동시에 WAITING 방에 join 시도).
     *
     * @return true: 참가 성공, false: 이미 정원(2명) 차거나 방 없음
     */
    public boolean addPlayer(String roomId, PlayerInfo player) {
        ReentrantLock lock = roomLocks.computeIfAbsent(roomId, k -> new ReentrantLock(true));
        lock.lock();
        try {
            MinesweeperBattleRoom room = rooms.get(roomId);
            if (room == null || room.getPlayerCount() >= 2) return false;

            room.getPlayers().add(player);
            playerToRoom.put(player.getPlayerId(), roomId);
            log.debug("MinesweeperRoomManager.addPlayer: roomId={} playerId={}", roomId, player.getPlayerId());
            return true;
        } finally {
            lock.unlock();
        }
    }

    // ─── 세션 등록 / 해제 ────────────────────────────────────────────────────

    /**
     * REST join 후 WS 연결 시점에 sessionId 를 플레이어에 등록.
     */
    public void registerSession(String roomId, String playerId, String sessionId) {
        MinesweeperBattleRoom room = rooms.get(roomId);
        if (room == null) return;

        PlayerInfo player = room.findPlayer(playerId);
        if (player == null) return;

        // 이전 세션 매핑 제거
        if (player.getSessionId() != null) {
            sessionToRoom.remove(player.getSessionId());
        }
        player.setSessionId(sessionId);
        player.setConnected(true);
        player.setDisconnected(false);
        sessionToRoom.put(sessionId, roomId);
        log.debug("MinesweeperRoomManager.registerSession: roomId={} playerId={} sessionId={}", roomId, playerId, sessionId);
    }

    /** sessionId → roomId 역방향 조회 */
    public Optional<String> findRoomIdBySession(String sessionId) {
        return Optional.ofNullable(sessionToRoom.get(sessionId));
    }

    /** sessionId 를 sessionToRoom 에서 제거 (연결 끊김 시) */
    public void unregisterSession(String sessionId) {
        String roomId = sessionToRoom.remove(sessionId);
        if (roomId != null) {
            MinesweeperBattleRoom room = rooms.get(roomId);
            if (room != null) {
                PlayerInfo player = room.findPlayerBySession(sessionId);
                if (player != null) {
                    player.setConnected(false);
                    player.setDisconnected(true);
                }
            }
        }
    }

    // ─── 조회 / 판별 ─────────────────────────────────────────────────────────

    /** playerId 가 속한 roomId 조회 */
    public Optional<String> findRoomIdByPlayer(String playerId) {
        return Optional.ofNullable(playerToRoom.get(playerId));
    }

    /** 플레이어가 어느 방에든 이미 참가 중인지 확인 */
    public boolean isPlayerInAnyRoom(String playerId) {
        return playerToRoom.containsKey(playerId);
    }

    /** 현재 활성 방 수 (모니터링용) */
    public int activeRoomCount() {
        return rooms.size();
    }

    /** 방별 ReentrantLock 반환 (Service 에서 방 상태 변경 시 사용) */
    public ReentrantLock getRoomLock(String roomId) {
        return roomLocks.computeIfAbsent(roomId, k -> new ReentrantLock(true));
    }

    // ─── 플레이어 제거 ────────────────────────────────────────────────────────

    /**
     * 방에서 플레이어를 제거하고 인덱스를 정리한다.
     */
    public void removePlayer(String roomId, String playerId) {
        MinesweeperBattleRoom room = rooms.get(roomId);
        if (room == null) return;

        room.getPlayers().removeIf(p -> {
            if (p.getPlayerId().equals(playerId)) {
                playerToRoom.remove(playerId);
                if (p.getSessionId() != null) {
                    sessionToRoom.remove(p.getSessionId());
                }
                return true;
            }
            return false;
        });
    }
}
