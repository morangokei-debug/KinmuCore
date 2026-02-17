-- 雇用形態に「業務委託」を追加
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_employment_type_check;
ALTER TABLE staff ADD CONSTRAINT staff_employment_type_check 
  CHECK (employment_type IN ('full_time', 'part_time', 'contractor'));
