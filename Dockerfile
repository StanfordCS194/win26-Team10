FROM python:3.11-slim

WORKDIR /app

# System deps (if needed for your packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 libsm6 libxext6 libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# CRITICAL: Copy requirements FIRST for layer caching
COPY requirements-prod.txt .

# Install Python deps (this layer is cached if requirements unchanged)
RUN pip install --no-cache-dir -r requirements-prod.txt

# Copy application code LAST (changes most frequently)
COPY . .

# Entrypoint setup
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV PORT=8080
ENV PROD=true
ENV SERVICE_TYPE=api
EXPOSE 8080

CMD ["/entrypoint.sh"]
