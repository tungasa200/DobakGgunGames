package com.dobakggun.controller;

import com.dobakggun.dto.chat.ChatHistoryResponse;
import com.dobakggun.dto.chat.ChatMessageResponse;
import com.dobakggun.dto.chat.ChatRoomListResponse;
import com.dobakggun.dto.chat.ChatRoomResponse;
import com.dobakggun.dto.chat.CreateRoomRequest;
import com.dobakggun.entity.User;
import com.dobakggun.repository.UserRepository;
import com.dobakggun.service.ChatRedisService;
import com.dobakggun.service.ChatRoomService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatRestController {

    private final ChatRoomService chatRoomService;
    private final ChatRedisService chatRedisService;
    private final UserRepository userRepository;

    @GetMapping("/rooms")
    public ResponseEntity<ChatRoomListResponse> listRooms() {
        return ResponseEntity.ok(chatRoomService.listRooms());
    }

    @PostMapping("/rooms")
    public ResponseEntity<ChatRoomResponse> createRoom(@Valid @RequestBody CreateRoomRequest request,
                                                       Principal principal) {
        Long userId = Long.valueOf(principal.getName());
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        ChatRoomResponse response = chatRoomService.createRoom(request.getName(), userId, user.getNickname());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/rooms/{roomId}/history")
    public ResponseEntity<ChatHistoryResponse> getHistory(@PathVariable String roomId) {
        Optional<Map<Object, Object>> metaOpt = chatRedisService.getRoomMeta(roomId);
        if (metaOpt.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ROOM_NOT_FOUND");
        }
        Map<Object, Object> meta = metaOpt.get();
        String roomName = (String) meta.get("name");
        String creatorId = (String) meta.get("creatorId");

        boolean degraded = false;
        List<ChatMessageResponse> messages;
        try {
            messages = chatRedisService.getHistory(roomId);
        } catch (Exception e) {
            messages = List.of();
            degraded = true;
        }

        return ResponseEntity.ok(ChatHistoryResponse.builder()
                .roomId(roomId)
                .roomName(roomName)
                .creatorId(creatorId)
                .messages(messages)
                .degraded(degraded)
                .build());
    }

    @DeleteMapping("/rooms/{roomId}")
    public ResponseEntity<Void> deleteRoom(@PathVariable String roomId, Principal principal) {
        Optional<Map<Object, Object>> metaOpt = chatRedisService.getRoomMeta(roomId);
        if (metaOpt.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ROOM_NOT_FOUND");
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        String creatorId = (String) metaOpt.get().get("creatorId");
        boolean isCreator = principal.getName().equals(creatorId);

        if (!isAdmin && !isCreator) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "FORBIDDEN");
        }

        chatRoomService.deleteRoom(roomId);
        return ResponseEntity.noContent().build();
    }
}
