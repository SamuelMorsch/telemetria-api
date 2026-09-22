# Usa uma versão LTS e otimizada do Node.js
FROM node:20-alpine

# Define o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Copia os mapas de dependências primeiro (melhora o cache de build)
COPY package*.json ./

# Instala apenas as bibliotecas necessárias para produção
RUN npm install --omit=dev

# Copia o restante do código da API
COPY . .

# Expõe a porta 3000 para comunicação externa
EXPOSE 3000

# Comando oficial de inicialização
CMD ["npm", "start"]