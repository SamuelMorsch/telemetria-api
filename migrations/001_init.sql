-- Modelo de dados v2 do sistema de telemetria.
-- A extensão já vem instalada na imagem timescale/timescaledb; esta linha é só garantia.
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Oficinas (clientes B2B do sistema)
CREATE TABLE workshops (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Usuários: mecânicos e administradores da oficina, ou motoristas
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id   uuid NOT NULL REFERENCES workshops(id),
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          text NOT NULL CHECK (role IN ('admin', 'mechanic', 'driver')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Veículos atendidos pela oficina
CREATE TABLE vehicles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id),
  plate       text NOT NULL,
  model       text,
  owner_name  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workshop_id, plate)
);

-- Uma sessão = um trajeto monitorado pelo app (do "conectar" ao "desconectar")
CREATE TABLE monitoring_sessions (
  id          uuid PRIMARY KEY,                -- gerado pelo app, para o envio ser idempotente
  vehicle_id  uuid NOT NULL REFERENCES vehicles(id),
  started_at  timestamptz NOT NULL,
  ended_at    timestamptz,
  source      text NOT NULL DEFAULT 'obd' CHECK (source IN ('obd', 'simulator')),
  app_version text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Leituras de telemetria (série temporal)
CREATE TABLE readings (
  time                   timestamptz NOT NULL,   -- instante da leitura, medido no celular
  session_id             uuid        NOT NULL REFERENCES monitoring_sessions(id),
  seq                    integer     NOT NULL,   -- nº sequencial dentro da sessão
  battery_voltage        real,                   -- ELM327 "AT RV" (tensão no conector, em volts)
  control_module_voltage real,                   -- PID 01 42 (tensão informada pela ECU, em volts)
  rpm                    integer,
  speed_kmh              integer,
  coolant_temp_c         integer,
  -- Reenviar a mesma leitura não duplica: (sessão, seq, instante) é único.
  PRIMARY KEY (session_id, seq, time)
);
SELECT create_hypertable('readings', 'time');
CREATE INDEX readings_session_time_idx ON readings (session_id, time DESC);

-- Códigos de falha (DTC) lidos na sessão
CREATE TABLE dtcs (
  id          bigserial PRIMARY KEY,
  session_id  uuid NOT NULL REFERENCES monitoring_sessions(id),
  code        text NOT NULL,
  description text,
  detected_at timestamptz NOT NULL,
  UNIQUE (session_id, code)
);

-- Eventos detectados automaticamente (ex.: queda de tensão com o motor girando)
CREATE TABLE anomaly_events (
  id          bigserial PRIMARY KEY,
  session_id  uuid NOT NULL REFERENCES monitoring_sessions(id),
  kind        text NOT NULL,                    -- ex.: 'voltage_drop'
  started_at  timestamptz NOT NULL,
  ended_at    timestamptz,
  min_value   real,
  details     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX anomaly_events_session_idx ON anomaly_events (session_id, started_at DESC);
