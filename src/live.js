import { EventEmitter } from 'node:events';

/**
 * Publicador/assinante em memória: quem envia leituras publica aqui, e cada painel com
 * a transmissão ao vivo aberta recebe. Vale para uma instância da API (a nossa).
 * Com várias instâncias, trocaríamos por Redis pub/sub ou LISTEN/NOTIFY do PostgreSQL.
 */
export class LiveBus {
  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(0);
    this.count = 0;
  }

  /** Devolve a função que cancela a assinatura (pode ser chamada mais de uma vez). */
  subscribe(sessionId, listener) {
    this.emitter.on(sessionId, listener);
    this.count += 1;
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.emitter.off(sessionId, listener);
      this.count -= 1;
    };
  }

  /** message = { event: 'readings' | 'ended', data: {...} } */
  publish(sessionId, message) {
    this.emitter.emit(sessionId, message);
  }
}
