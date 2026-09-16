ALTER TABLE expenses DROP CONSTRAINT expenses_created_by_fkey;
ALTER TABLE expenses ADD CONSTRAINT expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE invoices DROP CONSTRAINT invoices_company_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE waiting_list DROP CONSTRAINT waiting_list_practitioner_id_fkey;
ALTER TABLE waiting_list ADD CONSTRAINT waiting_list_practitioner_id_fkey FOREIGN KEY (practitioner_id) REFERENCES users(id) ON DELETE RESTRICT;
