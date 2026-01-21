NF Dispatch Planner - Production Deployment Guide
Prerequisites Checklist
Debian 12 (bookworm) VM with root/sudo access
DNS A record pointing dispatcher.neutralfuels.net to your VM's IP
Ports 80 and 443 open in firewall
Step 1: System Preparation
SSH into your VM and run these commands:

# Update system packages

sudo apt update && sudo apt upgrade -y

# Install essential packages

sudo apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    ufw \
    certbot
Step 2: Install Docker & Docker Compose

# Add Docker's official GPG key

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL <https://download.docker.com/linux/debian/gpg> | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add your user to docker group (replace 'youruser' with actual username)

sudo usermod -aG docker $USER

# Apply group changes (or logout/login)

newgrp docker

# Verify Docker installation

docker --version
docker compose version
Step 3: Configure Firewall

# Enable UFW

sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH, HTTP, and HTTPS

sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall

sudo ufw enable
sudo ufw status
Step 4: Clone the Repository

# Create application directory

sudo mkdir -p /opt/nf-dispatch
sudo chown $USER:$USER /opt/nf-dispatch
cd /opt/nf-dispatch

# Clone the repository

git clone <https://github.com/Neutral-Fuels/nf_dispatch_planner.git> .
Step 5: Create Production Environment File

# Copy the example file

cp .env.production.example .env.production

# Generate secure passwords and secret key

# Run these to generate random values

echo "DB_PASSWORD: $(openssl rand -base64 24)"
echo "REDIS_PASSWORD: $(openssl rand -base64 24)"
echo "SECRET_KEY: $(openssl rand -hex 32)"
Now edit the .env.production file:

nano .env.production
Update these values:

# ============================================

# NF Dispatch Planner - Production Environment

# ============================================

# ===================

# Database

# ===================

DB_USER=nf_production_user
DB_PASSWORD=<PASTE_GENERATED_DB_PASSWORD>
DB_NAME=nf_dispatch_prod
DB_PORT=5432

# ===================

# Redis

# ===================

REDIS_PASSWORD=<PASTE_GENERATED_REDIS_PASSWORD>
REDIS_PORT=6379

# ===================

# Application

# ===================

ENVIRONMENT=production
DEBUG=false
SECRET_KEY=<PASTE_GENERATED_SECRET_KEY>

# ===================

# CORS

# ===================

ALLOWED_ORIGINS=<https://dispatcher.neutralfuels.net>

# ===================

# API

# ===================

VITE_API_URL=<https://dispatcher.neutralfuels.net/api/v1>

# ===================

# Ports (for external access)

# ===================

BACKEND_PORT=8000
FRONTEND_PORT=3000

# ===================

# Backup

# ===================

BACKUP_DIR=/var/backups/nf_dispatch
BACKUP_RETENTION_DAYS=30

# ===================

# SSL (for Certbot)

# ===================

SSL_EMAIL=<admin@neutralfuels.com>
SSL_DOMAIN=dispatcher.neutralfuels.net
Save and exit (Ctrl+X, then Y, then Enter).

Step 6: Prepare Nginx for Initial HTTP (Pre-SSL)
Before getting SSL certificates, we need nginx running on HTTP. Create a temporary nginx config:

# Create SSL directory (empty for now)

mkdir -p nginx/ssl

# Create a temporary self-signed cert for initial startup

openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
    -keyout nginx/ssl/key.pem \
    -out nginx/ssl/cert.pem \
    -subj "/CN=dispatcher.neutralfuels.net"
Step 7: Build and Start Services

# Build all containers

docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production build

# Start the services

docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production up -d

# Check if containers are running

docker compose ps

# View logs (press Ctrl+C to exit)

docker compose logs -f
Step 8: Run Database Migrations

# Run Alembic migrations

docker compose exec backend alembic upgrade head

# Seed initial data (creates admin user and reference data)

docker compose exec backend python -m app.scripts.seed_data
The default admin credentials will be:

Username: admin
Password: admin123 (change immediately after first login!)
Step 9: Generate SSL Certificate with Certbot
First, stop nginx temporarily to free port 80:

docker compose stop nginx
Now run Certbot standalone to obtain certificates:

sudo certbot certonly --standalone \
    -d dispatcher.neutralfuels.net \
    --email <admin@neutralfuels.com> \
    --agree-tos \
    --non-interactive
Copy certificates to the nginx ssl directory:

# Copy certificates

sudo cp /etc/letsencrypt/live/dispatcher.neutralfuels.net/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/dispatcher.neutralfuels.net/privkey.pem nginx/ssl/key.pem

# Set permissions

sudo chown $USER:$USER nginx/ssl/cert.pem nginx/ssl/key.pem
chmod 644 nginx/ssl/cert.pem
chmod 600 nginx/ssl/key.pem
Step 10: Restart Nginx with SSL

# Start nginx with real SSL certificates

docker compose start nginx

# Verify all services are running

docker compose ps
Step 11: Set Up Automatic SSL Renewal
Create a renewal script:

sudo nano /opt/nf-dispatch/scripts/renew-ssl.sh
Add this content:

# !/bin/bash

# SSL Certificate Renewal Script

cd /opt/nf-dispatch

# Stop nginx to free port 80

docker compose stop nginx

# Renew certificate

certbot renew --quiet

# Copy new certificates

cp /etc/letsencrypt/live/dispatcher.neutralfuels.net/fullchain.pem nginx/ssl/cert.pem
cp /etc/letsencrypt/live/dispatcher.neutralfuels.net/privkey.pem nginx/ssl/key.pem

# Restart nginx

docker compose start nginx

echo "SSL renewal completed at $(date)" >> /var/log/nf-ssl-renewal.log
Make it executable and add to cron:

sudo chmod +x /opt/nf-dispatch/scripts/renew-ssl.sh

# Add to crontab (runs twice daily)

(sudo crontab -l 2>/dev/null; echo "0 2,14 ** * /opt/nf-dispatch/scripts/renew-ssl.sh") | sudo crontab -
Step 12: Set Up Backup Directory

# Create backup directory

sudo mkdir -p /var/backups/nf_dispatch
sudo chown $USER:$USER /var/backups/nf_dispatch

# Make backup script executable

chmod +x scripts/backup.sh

# Test backup

./scripts/backup.sh

# Add daily backup to cron (runs at 2 AM)

(crontab -l 2>/dev/null; echo "0 2 ** * cd /opt/nf-dispatch && ./scripts/backup.sh") | crontab -
Step 13: Verify Deployment

# Check all containers are healthy

docker compose ps

# Run health check script

chmod +x scripts/health_check.sh
./scripts/health_check.sh

# Test endpoints

curl -I <https://dispatcher.neutralfuels.net>
curl <https://dispatcher.neutralfuels.net/health>
Verification Checklist
Test Expected Result
<https://dispatcher.neutralfuels.net> Frontend loads (React app)
<https://dispatcher.neutralfuels.net/health> {"status": "healthy", ...}
<https://dispatcher.neutralfuels.net/docs> Swagger API documentation
Login with admin / admin123 Dashboard appears
Useful Commands

# View all logs

docker compose logs -f

# View specific service logs

docker compose logs -f backend
docker compose logs -f nginx

# Restart a service

docker compose restart backend

# Stop all services

docker compose down

# Start all services

docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production up -d

# Database backup

./scripts/backup.sh

# Database restore

./scripts/backup.sh --restore

# Health check

./scripts/health_check.sh

# Connect to database

docker compose exec db psql -U nf_production_user -d nf_dispatch_prod
Post-Deployment Tasks
Change admin password - Login and change the default password immediately
Create additional users - Create scheduler and viewer accounts as needed
Migrate Excel data - Use the migration script if you have existing data:

docker compose exec backend python -m app.scripts.migrate_excel_data /path/to/excel/files
Test all functionality - Verify drivers, tankers, customers, and scheduling work correctly
Troubleshooting
Container won't start:

docker compose logs <service-name>
Database connection issues:

docker compose exec db pg_isready -U nf_production_user -d nf_dispatch_prod
SSL certificate issues:

sudo certbot certificates
openssl x509 -in nginx/ssl/cert.pem -text -noout | grep -A2 "Validity"
Reset everything (WARNING: loses data):

docker compose down -v
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production up -d --build
Your application should now be live at <https://dispatcher.neutralfuels.net>!
