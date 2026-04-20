package com.dobakggun.repository;

import com.dobakggun.entity.PatchNote;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PatchNoteRepository extends JpaRepository<PatchNote, Long> {
    Page<PatchNote> findByGameOrderByCreatedAtDesc(PatchNote.Game game, Pageable pageable);
    Page<PatchNote> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
