-- Listar as sessões de um veículo, da mais recente para a mais antiga.
CREATE INDEX monitoring_sessions_vehicle_idx ON monitoring_sessions (vehicle_id, started_at DESC);
