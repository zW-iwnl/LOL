# Nasazení Test Manageru na Linux server

Tento postup je určený pro jeden produkční Linux server s Docker Engine a Docker Compose. Veřejný provoz ukončuje Caddy, který automaticky získá a obnovuje HTTPS certifikát. Frontend, backend a PostgreSQL nejsou přímo vystavené do internetu.

## 1. Výsledná topologie

```text
Internet :80/:443
        |
      Caddy
        |
  frontend (nginx)
        |
  backend (FastAPI)
        |
  PostgreSQL + Docker volume
```

Produkční soubory:

- `docker-compose.prod.yml`: definice služeb, sítí, health checků a volumes;
- `deploy/Caddyfile`: HTTPS proxy;
- `.env.production`: tajné a serverové nastavení, nevkládá se do Gitu;
- `deploy/scripts/deploy.sh`: validace, záloha, build a spuštění;
- `deploy/scripts/backup.sh`: konzistentní PostgreSQL dump.

## 2. Předpoklady

- Linux server, doporučený Ubuntu Server LTS nebo Debian;
- veřejná IPv4 nebo IPv6 adresa;
- doména s `A` nebo `AAAA` záznamem směřujícím na server;
- otevřené porty `80/tcp` a `443/tcp`, pro HTTP/3 volitelně `443/udp`;
- SSH přístup uživatele, který smí používat Docker;
- privátní Git repository obsahující commitnutou a označenou verzi aplikace.

Bez domény nelze automaticky získat veřejně důvěryhodný TLS certifikát. Pro dočasný test lze Caddy nakonfigurovat na IP adresu a použít HTTP, produkční provoz má používat doménu a HTTPS.

## 3. Příprava serveru

Nainstaluj Docker Engine a Compose plugin podle dokumentace zvolené Linux distribuce. Potom ověř:

```bash
docker version
docker compose version
git --version
```

Vytvoř cílový adresář a nastav jeho vlastníka:

```bash
sudo mkdir -p /opt/test-manager
sudo chown "$USER":"$USER" /opt/test-manager
```

Firewall má z internetu povolit pouze:

```text
22/tcp   SSH, ideálně omezené na administrační IP
80/tcp   HTTP a ACME ověření
443/tcp  HTTPS
443/udp  HTTP/3, volitelné
```

Porty PostgreSQL `5432` a backendu `8000` se na firewallu neotevírají.

## 4. Přenos aplikace

Doporučený způsob je privátní Git repository a verzované tagy:

```bash
git clone <URL_PRIVATNIHO_REPOZITARE> /opt/test-manager
cd /opt/test-manager
git checkout v0.1.0
```

Na server neposílej `.env`, `.env.production`, lokální databázový volume, `node_modules`, test reports ani vývojové screenshoty.

## 5. Produkční konfigurace

```bash
cd /opt/test-manager
cp .env.production.example .env.production
chmod 600 .env.production
```

Vygeneruj samostatné hodnoty pro databázi a JWT:

```bash
openssl rand -hex 24
openssl rand -hex 48
```

V `.env.production` změň minimálně:

```dotenv
DOMAIN=test-manager.firma.cz
ACME_EMAIL=spravce@firma.cz

POSTGRES_PASSWORD=<PRVNI_VYGENEROVANA_HODNOTA>
DATABASE_URL=postgresql+psycopg://test_manager:<STEJNA_DB_HODNOTA>@postgres:5432/test_manager
JWT_SECRET_KEY=<DRUHA_VYGENEROVANA_HODNOTA>

CORS_ORIGINS=["https://test-manager.firma.cz"]
```

Pro databázové heslo používej alfanumerickou nebo hexadecimální hodnotu. Speciální URL znaky by v `DATABASE_URL` musely být percent-encoded.

Ověř výslednou konfiguraci bez startu kontejnerů:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet
```

## 6. První nasazení

```bash
cd /opt/test-manager
bash deploy/scripts/deploy.sh
```

Skript:

1. ověří `.env.production` a Compose konfiguraci;
2. sestaví aktuální frontend a backend obrazy;
3. spustí PostgreSQL;
4. backend provede Alembic migrace;
5. spustí frontend a Caddy;
6. počká na health checky a ověří `/health` přes frontend.

Stav a logy:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100
```

## 7. První administrátor

Produkce nespouští demo seed. První účet vytvoř interaktivně, aby heslo nebylo v příkazové historii:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml \
  run --rm backend python scripts/create_admin.py
```

Skript požaduje jméno, validní e-mail a dvakrát heslo. Heslo musí mít alespoň 12 znaků a alespoň tři ze čtyř kategorií: malá písmena, velká písmena, číslice a symboly.

Záměrný reset existujícího administrátora:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml \
  run --rm backend python scripts/create_admin.py --update-existing
```

## 8. Ověření po nasazení

```bash
curl --fail --show-error https://test-manager.firma.cz/health
```

Očekávaná odpověď:

```json
{"status":"ok"}
```

V prohlížeči ověř:

1. přihlášení produkčním administrátorem;
2. vytvoření projektu;
3. vytvoření suite, test case a kroků;
4. vytvoření test runu a uložení výsledku;
6. odhlášení a opětovné přihlášení.

## 9. Zálohy

Ruční záloha:

```bash
cd /opt/test-manager
bash deploy/scripts/backup.sh
```

Výstup je PostgreSQL custom dump v adresáři `/opt/test-manager/backups`. Práva nového souboru jsou omezena pomocí `umask 077`.

Příklad denního cron záznamu ve 02:15:

```cron
15 2 * * * cd /opt/test-manager && /usr/bin/bash deploy/scripts/backup.sh >> /var/log/test-manager-backup.log 2>&1
```

Zálohy pravidelně kopíruj na jiné úložiště. Doporučená retence je 7 denních, 4 týdenní a 6 měsíčních kopií. Samotný Docker volume není záloha.

Obnova je destruktivní operace. Před obnovou zastav backend a frontend, vytvoř ještě jednu zálohu aktuálního stavu a obnov dump pomocí `pg_restore` do prázdné databáze. Obnovu nejdřív nacvič na neprodukčním serveru.

## 10. Aktualizace

Každá produkční verze má mít samostatný Git tag. Před nasazením nové verze:

```bash
cd /opt/test-manager
git fetch --tags
git checkout v0.2.0
bash deploy/scripts/deploy.sh
```

Pokud PostgreSQL už běží, deploy skript před změnou automaticky vytvoří databázovou zálohu. Vypnutí pouze pro vědomou servisní operaci:

```bash
BACKUP_BEFORE_DEPLOY=false bash deploy/scripts/deploy.sh
```

## 11. Rollback

Pro návrat aplikačního kódu:

```bash
cd /opt/test-manager
git checkout v0.1.0
BACKUP_BEFORE_DEPLOY=false bash deploy/scripts/deploy.sh
```

Rollback kódu automaticky nevrací databázové schéma. Migrace proto musí být zpětně kompatibilní. Pokud nová verze provedla nekompatibilní migraci, zastav aplikaci a obnov přednasazovací dump.

## 12. Provozní kontroly

Pravidelně kontroluj:

- dostupnost veřejného `/health`;
- stav a restart count kontejnerů;
- volné místo pro Docker volumes a zálohy;
- úspěšnost zálohovacího cron jobu;
- expiraci domény a funkčnost obnovy TLS certifikátu;
- dostupné bezpečnostní aktualizace hostitele a základních obrazů.

Zastavení aplikace bez odstranění dat:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml down
```

Nepoužívej `down --volumes`, protože by odstranil databázový volume.
