#!/usr/bin/env bash
# ==============================================================================
# UstensINT (Cook'It) — Script d'installation automatique pour VM Linux vierge
# Compatible : Ubuntu 22.04 / 24.04 LTS, Debian 11 / 12
# ==============================================================================

set -euo pipefail

# --- Couleurs pour le terminal ---
C_RESET='\033[0m'
C_BOLD='\033[1m'
C_GREEN='\033[32m'
C_CYAN='\033[36m'
C_YELLOW='\033[33m'
C_RED='\033[31m'
C_MAGENTA='\033[35m'

log_info() {
    echo -e "${C_CYAN}[INFO]${C_RESET} $1"
}

log_success() {
    echo -e "${C_GREEN}[SUCCÈS]${C_RESET} $1"
}

log_warn() {
    echo -e "${C_YELLOW}[ATTENTION]${C_RESET} $1"
}

log_error() {
    echo -e "${C_RED}[ERREUR]${C_RESET} $1"
}

banner() {
    echo -e "${C_CYAN}${C_BOLD}"
    cat << "EOF"
  _   _     _                 ___ _   _ _____ 
 | | | |___| |_ ___ _ __  ___|_ _| \ | |_   _|
 | | | / __| __/ _ \ '_ \/ __|| ||  \| | | |  
 | |_| \__ \ ||  __/ | | \__ \| || |\  | | |  
  \___/|___/\__\___|_| |_|___/___|_| \_| |_|  
              Cook'It — Installation Automatique
EOF
    echo -e "${C_RESET}"
}

# 1. Vérification des droits root
if [ "$EUID" -ne 0 ]; then
    log_error "Ce script doit être exécuté en tant que root ou avec sudo."
    echo "Exécutez : sudo ./setup.sh"
    exit 1
fi

banner

# 2. Détection du système d'exploitation
if [ ! -f /etc/os-release ]; then
    log_error "Impossible de détecter la distribution Linux (/etc/os-release introuvable)."
    exit 1
fi

. /etc/os-release
OS_NAME=$ID
OS_VERSION_ID=${VERSION_ID:-""}

log_info "Système détecté : $NAME ($VERSION)"

if [[ "$OS_NAME" != "ubuntu" && "$OS_NAME" != "debian" ]]; then
    log_warn "Ce script est optimisé pour Ubuntu ou Debian. Poursuite sous votre responsabilité..."
fi

# 3. Questions interactives de configuration
echo -e "\n${C_BOLD}--- CONFIGURATION DE VOTRE APPLICATION ---${C_RESET}"

read -rp "Nom de domaine complet pour l'application web (ex: cookit.mon-domaine.fr) : " DOMAIN_NAME
DOMAIN_NAME=${DOMAIN_NAME:-"localhost"}

read -rp "Adresse email de l'administrateur / contact (ex: admin@mon-domaine.fr) : " ADMIN_EMAIL
ADMIN_EMAIL=${ADMIN_EMAIL:-"admin@telecom-sudparis.eu"}

echo ""
read -rp "Souhaitez-vous installer et configurer un serveur SMTP dédié (docker-mailserver) ? [O/n] : " INSTALL_SMTP_CHOICE
INSTALL_SMTP_CHOICE=${INSTALL_SMTP_CHOICE:-"O"}

ENABLE_SMTP=false
if [[ "$INSTALL_SMTP_CHOICE" =~ ^[oOyY]$ ]]; then
    ENABLE_SMTP=true
    read -rp "Domaine principal pour les emails (ex: mon-domaine.fr) : " MAIL_DOMAIN
    MAIL_DOMAIN=${MAIL_DOMAIN:-"mon-domaine.fr"}
    
    read -rp "Nom d'hôte du serveur mail (ex: mail.mon-domaine.fr) : " MAIL_HOSTNAME
    MAIL_HOSTNAME=${MAIL_HOSTNAME:-"mail.$MAIL_DOMAIN"}

    read -rp "Adresse email du compte d'envoi automatique (ex: noreply@$MAIL_DOMAIN) : " SMTP_USER_EMAIL
    SMTP_USER_EMAIL=${SMTP_USER_EMAIL:-"noreply@$MAIL_DOMAIN"}

    SMTP_USER_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)
    echo -e "Mot de passe généré automatiquement pour $SMTP_USER_EMAIL : ${C_YELLOW}${SMTP_USER_PASS}${C_RESET}"
fi

# 4. Mise à jour du système & Dépendances
log_info "Mise à jour du système et installation des outils de base..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl git ufw fail2ban openssl certbot ca-certificates gnupg lsb-release jq

# 5. Configuration du Pare-feu UFW
log_info "Configuration sécurisée du pare-feu UFW..."
ufw default deny incoming >/dev/null 2>&1
ufw default allow outgoing >/dev/null 2>&1
ufw allow 22/tcp >/dev/null 2>&1    # SSH
ufw allow 80/tcp >/dev/null 2>&1    # HTTP
ufw allow 443/tcp >/dev/null 2>&1   # HTTPS

if [ "$ENABLE_SMTP" = true ]; then
    ufw allow 25/tcp >/dev/null 2>&1   # SMTP entrant
    ufw allow 587/tcp >/dev/null 2>&1  # SMTP STARTTLS
    ufw allow 465/tcp >/dev/null 2>&1  # SMTPS
    ufw allow 993/tcp >/dev/null 2>&1  # IMAPS
fi

ufw --force enable >/dev/null 2>&1
log_success "Pare-feu UFW configuré et activé."

# 6. Installation de Docker & Docker Compose
if ! command -v docker &> /dev/null; then
    log_info "Installation de Docker Engine officiel..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL "https://download.docker.com/linux/$OS_NAME/gpg" -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$OS_NAME \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker >/dev/null 2>&1
    log_success "Docker Engine installé avec succès."
else
    log_info "Docker est déjà présent sur le système."
fi

# 7. Génération des clés secrètes et du fichier .env
log_info "Génération du fichier .env et des clés cryptographiques..."
JWT_SECRET=$(openssl rand -hex 32)
POSTGRES_PASS=$(openssl rand -hex 16)

PUBLIC_APP_URL="http://$DOMAIN_NAME"
if [[ "$DOMAIN_NAME" != "localhost" && "$DOMAIN_NAME" != "127.0.0.1" ]]; then
    PUBLIC_APP_URL="https://$DOMAIN_NAME"
fi

cat <<EOF > .env
# Configuration générée automatiquement par setup.sh
PUBLIC_URL=${PUBLIC_APP_URL}

# Base de données PostgreSQL
POSTGRES_USER=ustensint
POSTGRES_PASSWORD=${POSTGRES_PASS}
POSTGRES_DB=ustensint
DATABASE_URL=postgresql+asyncpg://ustensint:${POSTGRES_PASS}@db:5432/ustensint

# Sécurité JWT
SECRET_KEY=${JWT_SECRET}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_DAYS=7

# Origines CORS autorisées
CORS_ORIGINS=["${PUBLIC_APP_URL}","http://localhost","http://127.0.0.1"]
EOF

if [ "$ENABLE_SMTP" = true ]; then
cat <<EOF >> .env

# Configuration SMTP Serveur
SMTP_HOST=${MAIL_HOSTNAME}
SMTP_PORT=587
SMTP_USER=${SMTP_USER_EMAIL}
SMTP_PASSWORD=${SMTP_USER_PASS}
SMTP_FROM=${SMTP_USER_EMAIL}
EOF
fi

log_success "Fichier .env généré."

# 8. Déploiement optionnel du serveur SMTP dédié
DKIM_KEY_TXT=""
if [ "$ENABLE_SMTP" = true ]; then
    log_info "Configuration du serveur SMTP dédié (docker-mailserver)..."
    mkdir -p /var/mailserver
    cd /var/mailserver

    # Génération du certificat SSL Let's Encrypt si domaine valide
    if [[ "$MAIL_HOSTNAME" != "localhost" ]]; then
        log_info "Génération du certificat SSL Let's Encrypt pour $MAIL_HOSTNAME..."
        certbot certonly --standalone -d "$MAIL_HOSTNAME" --agree-tos -m "$ADMIN_EMAIL" -n --non-interactive || log_warn "Certbot a échoué (vérifiez vos DNS Cloudflare)."
    fi

    cat <<EOF > docker-compose.yml
services:
  mailserver:
    image: ghcr.io/docker-mailserver/docker-mailserver:latest
    container_name: mailserver
    hostname: ${MAIL_HOSTNAME}
    domainname: ${MAIL_DOMAIN}
    restart: always
    ports:
      - "25:25"
      - "587:587"
      - "465:465"
      - "993:993"
    environment:
      - OVERRIDE_HOSTNAME=${MAIL_HOSTNAME}
      - LOG_LEVEL=info
      - ENABLE_RSPAMD=1
      - ENABLE_CLAMAV=0
      - ENABLE_FAIL2BAN=1
      - SSL_TYPE=letsencrypt
      - SSL_CERT_PATH=/etc/letsencrypt/live/${MAIL_HOSTNAME}/fullchain.pem
      - SSL_KEY_PATH=/etc/letsencrypt/live/${MAIL_HOSTNAME}/privkey.pem
      - ONE_DIR=1
      - DMS_SSL=letsencrypt
    volumes:
      - ./dms/mail-data/:/var/mail/
      - ./dms/mail-state/:/var/mail-state/
      - ./dms/mail-logs/:/var/log/mail/
      - ./dms/config/:/tmp/docker-mailserver/
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - /etc/localtime:/etc/localtime:ro
    cap_add:
      - NET_ADMIN
      - SYS_PTRACE
EOF

    docker compose up -d
    log_info "Attente du démarrage du serveur mail..."
    sleep 5

    # Création du compte email
    docker exec mailserver setup email add "$SMTP_USER_EMAIL" "$SMTP_USER_PASS" >/dev/null 2>&1 || true
    docker exec mailserver setup config dkim domain "$MAIL_DOMAIN" >/dev/null 2>&1 || true

    DKIM_PATH="/var/mailserver/dms/config/opendkim/keys/$MAIL_DOMAIN/mail.txt"
    if [ -f "$DKIM_PATH" ]; then
        DKIM_KEY_TXT=$(cat "$DKIM_PATH")
    fi

    # Retour au répertoire de l'application
    cd - >/dev/null
    log_success "Serveur SMTP déployé et compte créé ($SMTP_USER_EMAIL)."
fi

# 9. Lancement des conteneurs UstensINT
log_info "Construction et démarrage des conteneurs Docker Cook'It..."
docker compose up --build -d

# 10. Tâche cron pour la sauvegarde automatique
log_info "Configuration de la sauvegarde automatique quotidienne de la base de données..."
mkdir -p /var/backups/cookit
CRON_CMD="0 3 * * * cd $(pwd) && docker compose exec -T db pg_dump -U ustensint ustensint | gzip > /var/backups/cookit/backup_\$(date +\\%Y\\%m\\%d).sql.gz"
(crontab -l 2>/dev/null | grep -v "pg_dump" ; echo "$CRON_CMD") | crontab -

# 11. Affichage du récapitulatif
SERVER_IP=$(curl -s https://api.ipify.org || hostname -I | awk '{print $1}')

echo -e "\n${C_GREEN}${C_BOLD}================================================================${C_RESET}"
echo -e "${C_GREEN}${C_BOLD}         🎉 INSTALLATION ET DÉPLOIEMENT TERMINÉS !             ${C_RESET}"
echo -e "${C_GREEN}${C_BOLD}================================================================${C_RESET}"

echo -e "\n${C_BOLD}🌐 Accès à l'application :${C_RESET}"
echo -e "  - URL Web : ${C_CYAN}${PUBLIC_APP_URL}${C_RESET}"
echo -e "  - API Backend : ${C_CYAN}${PUBLIC_APP_URL}/api/docs${C_RESET}"
echo -e "  - Compte Admin initial : ${C_YELLOW}admin@telecom-sudparis.eu${C_RESET}"

if [ "$ENABLE_SMTP" = true ]; then
    echo -e "\n${C_BOLD}📧 Configuration DNS Cloudflare pour le Serveur Mail :${C_RESET}"
    echo -e "  1. Enregistrement A (DNS Only ⚪) :"
    echo -e "     - Type : ${C_CYAN}A${C_RESET} | Nom : ${C_CYAN}mail${C_RESET} | Cible : ${C_YELLOW}${SERVER_IP}${C_RESET} | Proxy : ${C_RED}Désactivé (Gris)${C_RESET}"
    echo -e "  2. Enregistrement MX :"
    echo -e "     - Type : ${C_CYAN}MX${C_RESET} | Nom : ${C_CYAN}@${C_RESET} | Cible : ${C_CYAN}${MAIL_HOSTNAME}${C_RESET} | Priorité : 10"
    echo -e "  3. Enregistrement SPF (TXT) :"
    echo -e "     - Type : ${C_CYAN}TXT${C_RESET} | Nom : ${C_CYAN}@${C_RESET} | Valeur : ${C_CYAN}v=spf1 mx a:${MAIL_HOSTNAME} ip4:${SERVER_IP} ~all${C_RESET}"
    echo -e "  4. Enregistrement DMARC (TXT) :"
    echo -e "     - Type : ${C_CYAN}TXT${C_RESET} | Nom : ${C_CYAN}_dmarc${C_RESET} | Valeur : ${C_CYAN}v=DMARC1; p=quarantine; sp=quarantine; pct=100;${C_RESET}"
    
    if [ -n "$DKIM_KEY_TXT" ]; then
        echo -e "  5. Enregistrement DKIM (TXT) :"
        echo -e "     - Type : ${C_CYAN}TXT${C_RESET} | Nom : ${C_CYAN}mail._domainkey${C_RESET}"
        echo -e "     - Valeur : ${C_CYAN}${DKIM_KEY_TXT}${C_RESET}"
    fi
fi

echo -e "\n${C_BOLD}🛠️ Commandes utiles :${C_RESET}"
echo -e "  - Voir les logs en direct : ${C_CYAN}docker compose logs -f${C_RESET}"
echo -e "  - Redémarrer l'application : ${C_CYAN}docker compose restart${C_RESET}"
echo -e "  - Mettre à jour l'application : ${C_CYAN}git pull && docker compose up --build -d${C_RESET}"
echo -e "${C_GREEN}================================================================${C_RESET}\n"
