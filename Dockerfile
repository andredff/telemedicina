FROM node:20-slim

# Dependências do sistema para canvas e tesseract
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    tesseract-ocr \
    tesseract-ocr-por \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala dependências primeiro (cache layer)
COPY package*.json ./
RUN npm install --omit=dev

# Copia apenas o servidor
COPY server/ ./server/

EXPOSE 10000

ENV NODE_ENV=production
ENV PORT=10000

CMD ["node", "server/cielo-server.js"]
