package com.dobakggun.service;

import com.dobakggun.dto.patchnote.PatchNoteRequest;
import com.dobakggun.entity.PatchNote;
import com.dobakggun.repository.PatchNoteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class PatchNoteService {

    private final PatchNoteRepository patchNoteRepository;

    public Page<PatchNote> getList(String gameStr, Pageable pageable) {
        if (gameStr == null || gameStr.isBlank()) {
            return patchNoteRepository.findAllByOrderByCreatedAtDesc(pageable);
        }
        PatchNote.Game game = PatchNote.Game.valueOf(gameStr.toUpperCase());
        return patchNoteRepository.findByGameOrderByCreatedAtDesc(game, pageable);
    }

    public PatchNote getDetail(Long id) {
        return patchNoteRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "패치노트를 찾을 수 없습니다"));
    }

    @Transactional
    public PatchNote create(PatchNoteRequest req) {
        PatchNote patchNote = PatchNote.builder()
                .version(req.getVersion())
                .title(req.getTitle())
                .content(req.getContent())
                .game(PatchNote.Game.valueOf(req.getGame().toUpperCase()))
                .build();
        return patchNoteRepository.save(patchNote);
    }

    @Transactional
    public PatchNote update(Long id, PatchNoteRequest req) {
        PatchNote patchNote = getDetail(id);
        patchNote.setVersion(req.getVersion());
        patchNote.setTitle(req.getTitle());
        patchNote.setContent(req.getContent());
        patchNote.setGame(PatchNote.Game.valueOf(req.getGame().toUpperCase()));
        return patchNote;
    }

    @Transactional
    public void delete(Long id) {
        if (!patchNoteRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "패치노트를 찾을 수 없습니다");
        }
        patchNoteRepository.deleteById(id);
    }
}
