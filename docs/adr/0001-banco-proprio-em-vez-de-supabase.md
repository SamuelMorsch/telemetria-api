# ADR 0001 - PostgreSQL/TimescaleDB próprio em vez de Supabase

**Status:** aceita

## Contexto
A versão 1 usava o Supabase como banco e o painel lia os dados direto dele pelo navegador
(`supabase-js`, chave pública e Realtime). Isso pulava a API, deixava a tabela exposta
(sem RLS) e o Playbook do curso veta plataformas BaaS que entregam banco, autenticação e
APIs automáticas sem controle da arquitetura.

## Decisão
Rodar PostgreSQL com a extensão TimescaleDB em container Docker na própria EC2, acessível
apenas pela API na rede interna. O painel passa a consumir somente a API.

## Consequências
- (+) Controle total do modelo de dados, das regras de acesso e dos backups.
- (+) TimescaleDB é feito para séries temporais, o que combina com as leituras de tensão.
- (+) O banco não tem porta exposta na internet.
- (-) Backup e atualização do banco passam a ser responsabilidade do projeto.
