FROM python:3.12-slim

# Install system dependencies: nmap, perl, git, and wget
RUN apt-get update && apt-get install -y \
    nmap \
    perl \
    git \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install Nikto globally
RUN git clone https://github.com/sullo/nikto.git /opt/nikto && \
    ln -s /opt/nikto/program/nikto.pl /usr/local/bin/nikto

# Set working directory
WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend code
COPY . .

# Expose port (Railway provides PORT environment variable)
EXPOSE 8000

# Start FastAPI server
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]
