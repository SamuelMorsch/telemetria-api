-- Um mesmo código pode aparecer primeiro como PENDENTE (o veículo detectou, mas ainda não
-- confirmou) e depois como CONFIRMADO. Passamos a guardar o estado e a permitir os dois.
ALTER TABLE dtcs
  ADD COLUMN status text NOT NULL DEFAULT 'stored'
  CHECK (status IN ('stored', 'pending', 'permanent'));

ALTER TABLE dtcs DROP CONSTRAINT IF EXISTS dtcs_session_id_code_key;
ALTER TABLE dtcs ADD CONSTRAINT dtcs_session_code_status_key UNIQUE (session_id, code, status);

CREATE INDEX dtcs_session_idx ON dtcs (session_id, detected_at);
