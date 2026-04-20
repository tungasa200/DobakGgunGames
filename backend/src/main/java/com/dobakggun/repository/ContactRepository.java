package com.dobakggun.repository;

import com.dobakggun.entity.Contact;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;


public interface ContactRepository extends JpaRepository<Contact, Long> {
    Page<Contact> findByUserId(Long userId, Pageable pageable);
    Page<Contact> findByStatus(Contact.Status status, Pageable pageable);
    Page<Contact> findByStatusAndCategory(Contact.Status status, String category, Pageable pageable);
    Page<Contact> findByCategory(String category, Pageable pageable);
    long countByStatus(Contact.Status status);
}
