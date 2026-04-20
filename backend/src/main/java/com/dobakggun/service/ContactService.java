package com.dobakggun.service;

import com.dobakggun.entity.Contact;
import com.dobakggun.repository.ContactRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class ContactService {

    private final ContactRepository contactRepository;
    private final EmailService emailService;

    @Transactional
    public Contact submit(Long userId, String email, String userNickname, String category, String subject, String body, String fileKeys) {
        Contact contact = Contact.builder()
                .userId(userId)
                .email(email)
                .userNickname(userNickname)
                .category(category)
                .subject(subject)
                .body(body)
                .fileKeys(fileKeys)
                .build();
        return contactRepository.save(contact);
    }

    // 유저 본인 문의 목록
    public Page<Contact> getMyContacts(Long userId, Pageable pageable) {
        return contactRepository.findByUserId(userId, pageable);
    }

    // 유저 본인 문의 상세 (소유권 검증)
    public Contact getMyContact(Long userId, Long contactId) {
        Contact contact = contactRepository.findById(contactId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "문의를 찾을 수 없습니다"));
        if (!contact.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "접근 권한이 없습니다");
        }
        return contact;
    }

    // 어드민 — 전체 목록
    public Page<Contact> getAll(Contact.Status status, String category, Pageable pageable) {
        if (status != null && category != null) {
            return contactRepository.findByStatusAndCategory(status, category, pageable);
        } else if (status != null) {
            return contactRepository.findByStatus(status, pageable);
        } else if (category != null) {
            return contactRepository.findByCategory(category, pageable);
        }
        return contactRepository.findAll(pageable);
    }

    // 어드민 — 상세 조회 + 자동 READ 전환
    @Transactional
    public Contact getAndMarkRead(Long contactId) {
        Contact contact = contactRepository.findById(contactId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "문의를 찾을 수 없습니다"));
        if (contact.getStatus() == Contact.Status.UNREAD) {
            contact.setStatus(Contact.Status.READ);
        }
        return contact;
    }

    // 어드민 — 답변 작성 + 이메일 발송
    @Transactional
    public Contact reply(Long contactId, Long adminId, String replyContent) {
        Contact contact = contactRepository.findById(contactId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "문의를 찾을 수 없습니다"));
        contact.setReply(replyContent);
        contact.setRepliedAt(LocalDateTime.now());
        contact.setRepliedBy(adminId);
        contact.setStatus(Contact.Status.REPLIED);
        emailService.sendContactReplyEmail(contact.getEmail(), contact.getSubject(), replyContent);
        return contact;
    }

    // 어드민 — 상태 수동 변경
    @Transactional
    public void updateStatus(Long contactId, Contact.Status status) {
        Contact contact = contactRepository.findById(contactId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "문의를 찾을 수 없습니다"));
        contact.setStatus(status);
    }

    // 어드민 — 삭제
    @Transactional
    public void delete(Long contactId) {
        if (!contactRepository.existsById(contactId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "문의를 찾을 수 없습니다");
        }
        contactRepository.deleteById(contactId);
    }

    public long countUnread() {
        return contactRepository.countByStatus(Contact.Status.UNREAD);
    }
}
