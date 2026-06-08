CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  owner TEXT,
  rc TEXT,
  nif TEXT,
  nis TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  total_ht NUMERIC(12, 2) NOT NULL,
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_discount_ht NUMERIC(12, 2) NOT NULL,
  vat NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_ttc NUMERIC(12, 2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'Par cheque ou virement bancaire',
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_invoice_id UUID NOT NULL REFERENCES company_invoices(id) ON DELETE CASCADE,
  designation TEXT NOT NULL,
  session_count INTEGER NOT NULL DEFAULT 0,
  learner_count INTEGER NOT NULL DEFAULT 0,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_ht NUMERIC(12, 2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS companies_name_idx ON companies (name);
CREATE INDEX IF NOT EXISTS company_invoices_company_id_idx ON company_invoices (company_id);
CREATE INDEX IF NOT EXISTS company_invoices_date_idx ON company_invoices (invoice_date);
CREATE INDEX IF NOT EXISTS company_invoice_items_invoice_id_idx ON company_invoice_items (company_invoice_id);
