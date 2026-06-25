FROM node:18-alpine

WORKDIR /app

# Install dependencies first for caching layers
COPY package*.json ./
RUN npm install --production

# Copy source code
COPY . .

EXPOSE 5000

# Default command starts the API server
CMD ["node", "src/server.js"]
