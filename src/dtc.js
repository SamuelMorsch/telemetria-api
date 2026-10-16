/**
 * Descrições dos códigos de falha (DTC) mais comuns, em português.
 * Cobre códigos GENÉRICOS da norma SAE J2012 / ISO 15031-6, com foco no sistema elétrico
 * (carga, bateria, módulos). Códigos fora da lista recebem uma explicação pela estrutura do
 * próprio código (ver `describeDtc`). Não é um catálogo completo.
 */
const DESCRIPTIONS = {
  // Aquecedor do sensor de oxigênio (circuito de controle)
  P0030: 'Circuito de controle do aquecedor do sensor de oxigênio (banco 1, sensor 1)',
  P0031: 'Circuito de controle do aquecedor do sensor de oxigênio (banco 1, sensor 1) com sinal baixo',
  P0032: 'Circuito de controle do aquecedor do sensor de oxigênio (banco 1, sensor 1) com sinal alto',
  P0036: 'Circuito de controle do aquecedor do sensor de oxigênio (banco 1, sensor 2)',
  P0037: 'Circuito de controle do aquecedor do sensor de oxigênio (banco 1, sensor 2) com sinal baixo',
  P0038: 'Circuito de controle do aquecedor do sensor de oxigênio (banco 1, sensor 2) com sinal alto',
  P0042: 'Circuito de controle do aquecedor do sensor de oxigênio (banco 1, sensor 3)',
  P0043: 'Circuito de controle do aquecedor do sensor de oxigênio (banco 1, sensor 3) com sinal baixo',
  P0044: 'Circuito de controle do aquecedor do sensor de oxigênio (banco 1, sensor 3) com sinal alto',
  P0050: 'Circuito de controle do aquecedor do sensor de oxigênio (banco 2, sensor 1)',
  P0051: 'Circuito de controle do aquecedor do sensor de oxigênio (banco 2, sensor 1) com sinal baixo',
  P0052: 'Circuito de controle do aquecedor do sensor de oxigênio (banco 2, sensor 1) com sinal alto',
  P0056: 'Circuito de controle do aquecedor do sensor de oxigênio (banco 2, sensor 2)',
  P0057: 'Circuito de controle do aquecedor do sensor de oxigênio (banco 2, sensor 2) com sinal baixo',
  P0058: 'Circuito de controle do aquecedor do sensor de oxigênio (banco 2, sensor 2) com sinal alto',
  // Ar, combustível e sensores
  P0087: 'Pressão do trilho/sistema de combustível muito baixa',
  P0088: 'Pressão do trilho/sistema de combustível muito alta',
  P0100: 'Circuito do sensor de fluxo de massa de ar (MAF)',
  P0101: 'Sensor MAF fora da faixa ou com desempenho incorreto',
  P0102: 'Sensor MAF com sinal baixo',
  P0103: 'Sensor MAF com sinal alto',
  P0105: 'Circuito do sensor de pressão do coletor (MAP) ou barométrica',
  P0106: 'Sensor MAP fora da faixa ou com desempenho incorreto',
  P0107: 'Sensor MAP com sinal baixo',
  P0108: 'Sensor MAP com sinal alto',
  P0110: 'Circuito do sensor de temperatura do ar de admissão',
  P0112: 'Sensor de temperatura do ar de admissão com sinal baixo',
  P0113: 'Sensor de temperatura do ar de admissão com sinal alto',
  P0115: 'Circuito do sensor de temperatura do líquido de arrefecimento',
  P0116: 'Sensor de temperatura do arrefecimento fora da faixa ou com desempenho incorreto',
  P0117: 'Sensor de temperatura do arrefecimento com sinal baixo',
  P0118: 'Sensor de temperatura do arrefecimento com sinal alto',
  P0120: 'Circuito do sensor de posição da borboleta/pedal (A)',
  P0121: 'Sensor de posição da borboleta/pedal (A) fora da faixa ou com desempenho incorreto',
  P0122: 'Sensor de posição da borboleta/pedal (A) com sinal baixo',
  P0123: 'Sensor de posição da borboleta/pedal (A) com sinal alto',
  P0125: 'Temperatura do arrefecimento insuficiente para o controle em malha fechada',
  P0128: 'Temperatura do arrefecimento abaixo da regulada pela válvula termostática',
  P0130: 'Circuito do sensor de oxigênio (banco 1, sensor 1)',
  P0131: 'Sensor de oxigênio (banco 1, sensor 1) com tensão baixa',
  P0132: 'Sensor de oxigênio (banco 1, sensor 1) com tensão alta',
  P0133: 'Sensor de oxigênio (banco 1, sensor 1) com resposta lenta',
  P0134: 'Sensor de oxigênio (banco 1, sensor 1) sem atividade',
  P0135: 'Circuito do aquecedor do sensor de oxigênio (banco 1, sensor 1)',
  P0141: 'Circuito do aquecedor do sensor de oxigênio (banco 1, sensor 2)',
  P0171: 'Mistura pobre demais (banco 1)',
  P0172: 'Mistura rica demais (banco 1)',
  P0174: 'Mistura pobre demais (banco 2)',
  P0175: 'Mistura rica demais (banco 2)',
  // Injetores e bomba de combustível
  P0200: 'Circuito do injetor de combustível',
  P0201: 'Circuito do injetor do cilindro 1',
  P0202: 'Circuito do injetor do cilindro 2',
  P0203: 'Circuito do injetor do cilindro 3',
  P0204: 'Circuito do injetor do cilindro 4',
  P0230: 'Circuito primário da bomba de combustível',
  // Ignição e falha de combustão
  P0300: 'Falhas de combustão aleatórias ou em vários cilindros',
  P0301: 'Falha de combustão no cilindro 1',
  P0302: 'Falha de combustão no cilindro 2',
  P0303: 'Falha de combustão no cilindro 3',
  P0304: 'Falha de combustão no cilindro 4',
  P0325: 'Circuito do sensor de detonação (knock) 1',
  P0335: 'Circuito do sensor de posição do virabrequim (A)',
  P0336: 'Sensor de posição do virabrequim (A) fora da faixa ou com desempenho incorreto',
  P0340: 'Circuito do sensor de posição do comando de válvulas (A)',
  P0341: 'Sensor de posição do comando de válvulas (A) fora da faixa ou com desempenho incorreto',
  P0351: 'Circuito primário/secundário da bobina de ignição A',
  P0352: 'Circuito primário/secundário da bobina de ignição B',
  P0353: 'Circuito primário/secundário da bobina de ignição C',
  P0354: 'Circuito primário/secundário da bobina de ignição D',
  // Emissões
  P0400: 'Falha no fluxo de recirculação dos gases de escape (EGR)',
  P0401: 'Fluxo de EGR insuficiente',
  P0402: 'Fluxo de EGR excessivo',
  P0403: 'Circuito da válvula EGR',
  P0420: 'Eficiência do catalisador abaixo do limite (banco 1)',
  P0430: 'Eficiência do catalisador abaixo do limite (banco 2)',
  P0440: 'Falha no sistema de controle de emissões evaporativas (EVAP)',
  P0441: 'Fluxo de purga do EVAP incorreto',
  P0442: 'Vazamento pequeno no sistema EVAP',
  P0443: 'Circuito da válvula de controle de purga do EVAP',
  P0446: 'Circuito da válvula de ventilação do EVAP',
  P0455: 'Vazamento grande no sistema EVAP (verifique a tampa do tanque)',
  P0456: 'Vazamento muito pequeno no sistema EVAP',
  // Auxiliares, ventoinha, marcha lenta, velocidade
  P0480: 'Circuito de controle da ventoinha de arrefecimento 1',
  P0481: 'Circuito de controle da ventoinha de arrefecimento 2',
  P0500: 'Sensor de velocidade do veículo (A)',
  P0505: 'Falha no sistema de controle da marcha lenta',
  P0506: 'Rotação da marcha lenta abaixo do esperado',
  P0507: 'Rotação da marcha lenta acima do esperado',
  P0510: 'Interruptor de posição de borboleta fechada',
  P0520: 'Circuito do sensor/interruptor de pressão do óleo do motor',
  P0524: 'Pressão do óleo do motor muito baixa',
  // Tensão do sistema e módulos (elétrica)
  P0560: 'Falha na tensão do sistema',
  P0561: 'Tensão do sistema instável',
  P0562: 'Tensão do sistema baixa (bateria/alternador não mantém a carga)',
  P0563: 'Tensão do sistema alta',
  P0600: 'Falha no enlace de comunicação serial',
  P0601: 'Erro de checksum na memória interna do módulo de controle',
  P0602: 'Erro de programação do módulo de controle',
  P0603: 'Erro na memória de manutenção (KAM) do módulo de controle',
  P0604: 'Erro de memória RAM do módulo de controle',
  P0605: 'Erro de memória ROM do módulo de controle',
  P0606: 'Falha no processador do módulo de controle (ECM/PCM)',
  P0607: 'Desempenho do módulo de controle',
  P0615: 'Circuito do relé do motor de partida',
  P0616: 'Circuito do relé do motor de partida com sinal baixo',
  P0617: 'Circuito do relé do motor de partida com sinal alto',
  P0620: 'Circuito de controle do gerador (alternador)',
  P0621: 'Circuito de controle da lâmpada "L" do gerador (alternador)',
  P0622: 'Circuito de controle do campo "F" do gerador (regulador do alternador)',
  // Transmissão
  P0700: 'Falha no sistema de controle da transmissão',
  P0705: 'Circuito do sensor de posição da alavanca (PRNDL) da transmissão',
  P0715: 'Circuito do sensor de velocidade de entrada da transmissão',
  P0720: 'Circuito do sensor de velocidade de saída da transmissão',
  P0730: 'Relação de marchas incorreta',
  // Rede de comunicação entre módulos
  U0001: 'Barramento de comunicação CAN de alta velocidade',
  U0073: 'Barramento de comunicação dos módulos desligado (bus off)',
  U0100: 'Perda de comunicação com o módulo do motor (ECM/PCM)',
  U0101: 'Perda de comunicação com o módulo da transmissão (TCM)',
  U0121: 'Perda de comunicação com o módulo do ABS',
  U0140: 'Perda de comunicação com o módulo da carroceria (BCM)',
  U0155: 'Perda de comunicação com o painel de instrumentos',
};

/** Códigos ligados à carga, à bateria e ao motor de partida: os que mais interessam a este projeto. */
export const ELECTRICAL = new Set([
  'P0560', 'P0561', 'P0562', 'P0563', 'P0615', 'P0616', 'P0617', 'P0620', 'P0621', 'P0622',
]);

const SYSTEM = {
  P: 'Motor e transmissão',
  C: 'Chassi (freios, direção, suspensão)',
  B: 'Carroceria (airbag, conforto, ar-condicionado)',
  U: 'Rede de comunicação entre módulos',
};

// 3º caractere dos códigos P: subsistema
const P_SUBSYSTEM = {
  0: 'medição de ar/combustível e controles auxiliares de emissões',
  1: 'medição de ar e combustível',
  2: 'medição de ar e combustível (injetores)',
  3: 'sistema de ignição ou falha de combustão',
  4: 'controles auxiliares de emissões',
  5: 'velocidade, marcha lenta e entradas auxiliares',
  6: 'computador (módulo) e circuitos de saída',
  7: 'transmissão',
  8: 'transmissão',
  9: 'transmissão',
};

const CODE_FORMAT = /^[PCBU][0-3][0-9A-F]{3}$/;

/** 'generic' (norma), 'manufacturer' (específico do fabricante) ou 'mixed' (reservado). */
function scopeOf(letter, digit) {
  if (digit === '3') return 'mixed';
  if (letter === 'P') return digit === '1' ? 'manufacturer' : 'generic'; // P0 e P2 são genéricos
  return digit === '0' ? 'generic' : 'manufacturer';
}

const SCOPE_TEXT = {
  generic: 'Código genérico (norma SAE/ISO)',
  manufacturer: 'Código específico do fabricante',
  mixed: 'Código reservado/misto',
};

/**
 * Explica um código. Se estiver no dicionário, devolve a descrição; senão, descreve o que o
 * formato do código já revela (sistema, tipo e, nos códigos P, o subsistema).
 */
export function describeDtc(rawCode) {
  const code = String(rawCode ?? '').trim().toUpperCase();
  if (!CODE_FORMAT.test(code)) {
    return { code, description: 'Código de falha inválido.', known: false, scope: 'unknown', electrical: false };
  }

  const scope = scopeOf(code[0], code[1]);
  const electrical = ELECTRICAL.has(code);
  const known = DESCRIPTIONS[code];
  if (known) return { code, description: known, known: true, scope, electrical };

  const subsystem = code[0] === 'P' ? P_SUBSYSTEM[code[2]] : undefined;
  const parts = [SCOPE_TEXT[scope], SYSTEM[code[0]]];
  if (subsystem) parts.push(subsystem);
  return {
    code,
    description: `${parts.join(' · ')}. Descrição específica não cadastrada: consulte o manual do fabricante.`,
    known: false,
    scope,
    electrical,
  };
}
