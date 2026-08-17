# Guide de Déploiement Complet — VM Linux, Cloudflare & Serveur SMTP Dédié

Ce guide détaille la mise en place d'une infrastructure complète sur une **machine virtuelle Linux vierge (Ubuntu / Debian)**, incluant la plateforme **UstensINT**, la configuration **Cloudflare**, et le déploiement d'un **serveur SMTP complet auto-hébergé (`docker-mailserver`)**.

---

## Sommaire
1. [Prérequis & Sécurisation de la VM](#1-prérequis--sécurisation-de-la-vm)
2. [Installation de Docker & Docker Compose](#2-installation-de-docker--docker-compose)
3. [Configuration DNS Cloudflare pour le Web et le Mail](#3-configuration-dns-cloudflare-pour-le-web-et-le-mail)
4. [Déploiement du Serveur SMTP Auto-Hébergé (`docker-mailserver`)](#4-déploiement-du-serveur-smtp-auto-hébergé-docker-mailserver)
5. [Génération des Clés DKIM & Signature des Emails](#5-génération-des-clés-dkim--signature-des-emails)
6. [Déploiement de l'Application Web (Cook'It)](#6-déploiement-de-lapplication-web-cookit)
7. [Test et Validation de la Délivrabilité (Score 10/10)](#7-test-et-validation-de-la-délivrabilité-score-1010)
8. [Maintenance, Mises à Jour & Sauvegardes](#8-maintenance-mises-à-jour--sauvegardes)

---

## 1. Prérequis & Sécurisation de la VM

### 1.1 Vérification du Port 25 & Reverse DNS (PTR)
Pour héberger votre propre serveur SMTP et envoyer des emails vers Gmail/Outlook sans être bloqué :
1. **Port 25 sortant** : Vérifiez que votre hébergeur (OVH, Hetzner, Scaleway, etc.) ne bloque pas le port 25.
   ```bash
   # Test rapide de connectivité SMTP sortante
   curl -v telnet://smtp.gmail.com:25
   ```
   *(Si la connexion échoue ou expire, demandez le déblocage du port 25 sortant au support de votre hébergeur).*
2. **Reverse DNS (PTR Record)** : Rendez-vous dans l'interface de gestion de votre VM chez votre hébergeur et associez l'adresse IP de votre VM au nom d'hôte : `mail.votre-domaine.fr`.

### 1.2 Pare-feu (UFW)
Ouvrez les ports web et les ports standards de messagerie (SMTP / Submission / IMAP) :
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw fail2ban certbot

# Configuration du pare-feu
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP (Let's Encrypt / Web)
sudo ufw allow 443/tcp     # HTTPS
sudo ufw allow 25/tcp      # SMTP (réception & relais)
sudo ufw allow 587/tcp     # SMTP Submission (envoi sécurisé avec STARTTLS)
sudo ufw allow 465/tcp     # SMTPS (envoi sécurisé SSL/TLS)
sudo ufw allow 993/tcp     # IMAPS (lecture sécurisée)
sudo ufw enable
```

---

## 2. Installation de Docker & Docker Compose

```bash
# Ajout du dépôt officiel Docker
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

---

## 3. Configuration DNS Cloudflare pour le Web et le Mail

> [!IMPORTANT]
> **Règle absolue Cloudflare pour le mail** : Le sous-domaine `mail.votre-domaine.fr` doit être en **DNS Only (Nuage Gris ⚪)** ! Cloudflare ne relaye que le trafic HTTP/HTTPS, pas les protocoles SMTP/IMAP.

Dans votre panneau de gestion **Cloudflare > DNS > Records**, ajoutez les enregistrements suivants :

| Type | Name | Content / Target | Proxy Status | Description |
|---|---|---|:---:|---|
| **A** | `cookit` | `IP_DE_VOTRE_VM` | **Proxied 🟠** | Accès au site web |
| **A** | `mail` | `IP_DE_VOTRE_VM` | **DNS Only ⚪ (Gris)** | Serveur SMTP / IMAP |
| **MX** | `@` | `mail.votre-domaine.fr` (Priorité 10) | — | Routage des emails entrants |
| **TXT** | `@` | `v=spf1 mx a:mail.votre-domaine.fr ip4:IP_DE_VOTRE_VM ~all` | — | Autorisation d'envoi SPF |
| **TXT** | `_dmarc` | `v=DMARC1; p=quarantine; sp=quarantine; pct=100;` | — | Politique de sécurité DMARC |

---

## 4. Déploiement du Serveur SMTP Auto-Hébergé (`docker-mailserver`)

Nous utilisons **docker-mailserver**, la référence open-source la plus robuste, légère et sécurisée (Postfix + Dovecot + Rspamd/OpenDKIM + TLS).

### 4.1 Préparer le dossier
```bash
sudo mkdir -p /var/mailserver
cd /var/mailserver
```

### 4.2 Générer le Certificat SSL pour `mail.votre-domaine.fr`
Pour que votre SMTP négocie du TLS sans avertissement :
```bash
sudo certbot certonly --standalone -d mail.votre-domaine.fr --agree-tos -m contact@votre-domaine.fr -n
```

### 4.3 Fichier `docker-compose.mail.yml`
Créez `/var/mailserver/docker-compose.yml` (`nano docker-compose.yml`) :

```yaml
services:
  mailserver:
    image: ghcr.io/docker-mailserver/docker-mailserver:latest
    container_name: mailserver
    hostname: mail.votre-domaine.fr
    domainname: votre-domaine.fr
    restart: always
    ports:
      - "25:25"       # Réception SMTP
      - "587:587"     # Envoi STARTTLS
      - "465:465"     # Envoi TLS Direct
      - "993:993"     # IMAP SSL
    environment:
      - OVERRIDE_HOSTNAME=mail.votre-domaine.fr
      - LOG_LEVEL=info
      - ENABLE_RSPAMD=1
      - ENABLE_CLAMAV=0
      - ENABLE_FAIL2BAN=1
      - SSL_TYPE=letsencrypt
      - SSL_CERT_PATH=/etc/letsencrypt/live/mail.votre-domaine.fr/fullchain.pem
      - SSL_KEY_PATH=/etc/letsencrypt/live/mail.votre-domaine.fr/privkey.pem
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
```

### 4.4 Démarrer le serveur et créer vos boîtes mail
```bash
# 1. Démarrer le conteneur
docker compose up -d

# 2. Créer une adresse email et son mot de passe
docker exec -ti mailserver setup email add contact@votre-domaine.fr "MotDePasseTresSecurise123!"
docker exec -ti mailserver setup email add noreply@votre-domaine.fr "AutreMotDePasseFort456!"

# 3. Créer un alias si nécessaire
docker exec -ti mailserver setup alias add cookit@votre-domaine.fr contact@votre-domaine.fr
```

---

## 5. Génération des Clés DKIM & Signature des Emails

Pour garantir que vos emails ne tombent jamais en spam, générez la signature DKIM :

```bash
# Générer la clé DKIM 2048-bit
docker exec -ti mailserver setup config dkim domain 'votre-domaine.fr'
```

Affichez la clé publique générée :
```bash
cat /var/mailserver/dms/config/opendkim/keys/votre-domaine.fr/mail.txt
```
Le résultat ressemble à ceci :
```text
mail._domainkey IN TXT ( "v=DKIM1; h=sha256; k=rsa; "
  "p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA..." )
```

### Ajouter l'enregistrement DKIM dans Cloudflare :
- **Type** : `TXT`
- **Name** : `mail._domainkey`
- **Value** : `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAO... (collez toute la chaîne entre guillemets sans espaces superflus)`

---

## 6. Déploiement de l'Application Web (Cook'It)

Dans `/var/www/cookit` :
```bash
cd /var/www/cookit
git clone https://github.com/Flotealy/UstensINT.git .
cp .env.example .env
```

Dans `.env`, vous pouvez maintenant utiliser votre propre SMTP local :
```env
SMTP_HOST=mail.votre-domaine.fr
SMTP_PORT=587
SMTP_USER=noreply@votre-domaine.fr
SMTP_PASSWORD=AutreMotDePasseFort456!
SMTP_FROM=noreply@votre-domaine.fr
```

Lancer l'application web :
```bash
docker compose up --build -d
```

---

## 7. Test et Validation de la Délivrabilité (Score 10/10)

Pour vous assurer que votre serveur SMTP est parfaitement configuré :
1. Rendez-vous sur [https://www.mail-tester.com/](https://www.mail-tester.com/).
2. Copiez l'adresse de test temporaire fournie (ex: `test-xyz@srv1.mail-tester.com`).
3. Envoyez un email de test depuis votre VM :
   ```bash
   docker exec -ti mailserver setup email send contact@votre-domaine.fr test-xyz@srv1.mail-tester.com "Test CookIt" "Bonjour, voici un email de test valide."
   ```
4. Cliquez sur **Vérifier mon score** sur Mail-Tester : vous devriez obtenir une note de **10/10** (SPF valide, DKIM signé, DMARC conforme, Reverse DNS PTR aligné).

---

## 8. Maintenance, Mises à Jour & Sauvegardes

### Renouvellement automatique du certificat SSL Mail
Ajoutez un cron (`sudo crontab -e`) pour renouveler le certificat SSL et recharger le conteneur SMTP :
```cron
0 4 * * 1 certbot renew --quiet && cd /var/mailserver && docker compose restart mailserver
```

### Sauvegarde des boîtes mail et bases de données
```bash
# Sauvegarder les données emails
tar -czf /var/backups/mail_$(date +%Y%m%d).tar.gz /var/mailserver/dms/mail-data
```
