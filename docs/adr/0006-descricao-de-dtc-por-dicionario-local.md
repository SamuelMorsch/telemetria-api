# ADR 0006 - Descrições de DTC por dicionário local com explicação estrutural

**Status:** aceita

## Contexto
O app v1 traduzia só 3 códigos de falha; os demais apareciam como "Falha de telemetria
identificada", o que não ajuda o mecânico. Um catálogo completo (milhares de códigos, com
variações por fabricante) exigiria uma fonte licenciada.

## Decisão
- **Dicionário próprio** com os códigos genéricos (SAE J2012 / ISO 15031-6) mais comuns, com foco
  no sistema elétrico, escrito em português.
- **Fallback estrutural:** para um código fora da lista, a API explica o que o formato já revela
  (letra = sistema, 2º caractere = genérico ou do fabricante, 3º = subsistema nos códigos P) e
  manda consultar o manual do fabricante. Nunca inventa um significado.
- **A descrição é definida no servidor**, não pelo app, para ser igual em todos os celulares.
- **Estado do código** (`stored`, `pending`, `permanent`): um código pendente que depois é confirmado
  vira dois registros, preservando quando cada estado apareceu.
- **Marca `electrical`** nos códigos de carga, bateria e partida, para o painel destacá-los ao lado da
  queda de tensão.

## Consequências
- (+) Resposta útil e honesta, sem depender de serviço externo.
- (-) Cobertura parcial. Ampliar o dicionário é só acrescentar linhas, mas códigos do fabricante
  exigem a documentação de cada marca.
