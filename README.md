# Telemetria Automotiva Avançada - Módulo API (Cloud)

**Nome do Estudante**: Samuel Morsch
**Instituição**: Universidade Católica de Santa Catarina
**Curso**: Ciência da Computação / Engenharia de Software

![Badge em Desenvolvimento](http://img.shields.io/static/v1?label=STATUS&message=EM%20DESENVOLVIMENTO&color=blue&style=for-the-badge)
![Badge Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Badge Express](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![Badge Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)

---

## 📋 Glossário e Navegação

- [Descrição do Projeto](#descrição)
- [Arquitetura do Sistema](#arquitetura)
- [Rotas da API (Endpoints)](#rotas)
- [Instruções de Execução Local](#execução)
- [Acesso em Produção (Nuvem)](#producao)

<a id="descrição"></a>
## ☁️ Descrição

Este repositório contém o **Módulo Cloud (API REST)** do sistema de Telemetria Automotiva Avançada. Desenvolvido em Node.js com o framework Express, este servidor atua como o nó central de comunicação da arquitetura polirepositório.

A principal responsabilidade desta API é atuar como ponte entre os dados coletados fisicamente nos veículos e a visualização remota, permitindo o acompanhamento de falhas (DTCs) em tempo real sem sobrecarregar a memória dos dispositivos móveis.

### Papel no Ecossistema
* **Receber:** Escutar requisições do aplicativo móvel (Edge) contendo pacotes JSON com o histórico de falhas decodificadas via scanner OBD-II.
* **Armazenar:** Gerenciar e persistir o histórico consolidado de telemetria da frota.
* **Prover:** Servir esses dados formatados e limpos para consumo pelo Painel Web Administrativo da oficina mecânica.

<a id="arquitetura"></a>
## 🏗️ Arquitetura e Stack

A API foi projetada para garantir baixo acoplamento e alta disponibilidade em nuvem, utilizando:
* **Runtime:** Node.js.
* **Framework Web:** Express (para roteamento eficiente e escalável).
* **Middlewares:** CORS (segurança de comunicação cross-origin) e Express.json (parse de payload).
* **Hospedagem:** Deploy automatizado e contínuo via Render, integrado diretamente à branch `main` do GitHub.

<a id="rotas"></a>
## 🛣️ Rotas da API (Endpoints)

Abaixo estão as portas de comunicação expostas pelo servidor:

* `GET /api/status` - **Health Check**: Retorna o status de integridade do servidor.
* `POST /api/sincronizar` - **Ingestão de Dados**: Rota consumida exclusivamente pelo aplicativo móvel para enviar o pacote JSON com as falhas detectadas (DTCs).
* `GET /api/falhas` - **Consumo de Dados**: Rota consumida pelo Painel Web para listar todo o histórico de falhas sincronizadas na nuvem.

<a id="execução"></a>
## 🚀 Instruções de Execução Local

### Pré-requisitos
* Node.js v18+ instalado.
* Gerenciador de pacotes npm.

### Setup Local

1. **Clone o repositório:**
   ```bash
   git clone [https://github.com/seu-usuario/telemetria-api.git](https://github.com/seu-usuario/telemetria-api.git)
   cd telemetria-api
