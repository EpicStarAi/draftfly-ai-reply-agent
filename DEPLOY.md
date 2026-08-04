# Деплой DraftFly на VPS

Один Docker-стек: Node-контейнер (API + статика дашборда и лендинга) и PostgreSQL. TLS-терминацию делает либо ваш существующий nginx на хосте (см. `deploy/nginx-draftfly.conf`), либо опциональный Caddy-контейнер (`--profile caddy`), если порты 80/443 свободны.

```
Интернет ── nginx или Caddy (:80/:443, TLS) ── app (Node, 127.0.0.1:8080) ── db (Postgres 16)
                                                ├─ /api/*  — Express API
                                                ├─ /app/*  — дашборд (SPA)
                                                └─ /*      — лендинг
```

HTTPS обязателен: cookie сессии ставится с флагом `secure`, и Slack принимает только https redirect URL. Поэтому нужен домен, направленный на VPS (A-запись), — по «голому» IP без TLS логин работать не будет.

## 1. Подготовка VPS

Подойдёт любой VPS с 1–2 GB RAM (Ubuntu 22.04+/Debian 12).

```bash
# Docker + compose-плагин
curl -fsSL https://get.docker.com | sh

git clone https://github.com/EpicStarAi/draftfly-ai-reply-agent.git
cd draftfly-ai-reply-agent
```

## 2. Конфигурация

```bash
cp deploy/.env.example deploy/.env
nano deploy/.env
```

Обязательно заполнить:

- `DOMAIN` и `APP_BASE_URL` — ваш домен (A-запись должна уже указывать на VPS);
- `POSTGRES_PASSWORD` — любой пароль (БД наружу не открыта);
- `SESSION_SECRET` — `openssl rand -hex 32`;
- `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN`, `SLACK_TEAM_ID`;
- `ANTHROPIC_API_KEY`, `LEMLIST_API_KEY`, `LEMLIST_WEBHOOK_SECRET`.

## 3. Настройка Slack-приложения (api.slack.com/apps)

1. **OAuth & Permissions → Redirect URLs**: добавить
   `https://<ваш-домен>/api/auth/slack/callback`
2. Вход теперь работает через **Sign in with Slack (OpenID Connect)** — скоупы `openid`, `profile`, `email` запрашиваются автоматически при логине, отдельно включать их в настройках не нужно. Старые user-скоупы `identity.*` больше не используются (Slack не выдаёт их новым приложениям — именно из-за этого логин был сломан).
3. **Bot Token Scopes** (для карточек одобрения): как минимум `chat:write`, `channels:read`.
4. **Interactivity & Shortcuts**: Request URL → `https://<ваш-домен>/api/slack/actions`
5. `SLACK_TEAM_ID` в `.env` — ID вашего воркспейса (начинается с `T`): ограничивает вход операторов вашей командой.

## 4. Первый запуск

```bash
cd deploy

# Собрать образы
docker compose build

# Создать/обновить схему БД (одноразово и после изменений схемы)
docker compose --profile setup run --rm migrate

# Запустить (app слушает 127.0.0.1:8080, наружу его выводит reverse-proxy)
docker compose up -d

# Логи
docker compose logs -f app
```

### 4a. Если на сервере уже работает nginx (порты 80/443 заняты)

```bash
cp deploy/nginx-draftfly.conf /etc/nginx/sites-available/draftfly.conf
ln -s /etc/nginx/sites-available/draftfly.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
# TLS-сертификат Let's Encrypt (добавит https и редирект сам):
certbot --nginx -d draftfly.app -d www.draftfly.app
```

### 4b. Если порты 80/443 свободны — Caddy вместо nginx

```bash
docker compose --profile caddy up -d   # авто-HTTPS по DOMAIN из .env
```

Проверка: `https://<домен>/` — лендинг, `https://<домен>/app` — дашборд (вход через Slack), `https://<домен>/api/healthz` — health-check.

## 5. Перенастроить внешние сервисы на новый домен

- **Lemlist / n8n webhook**: `https://<домен>/api/webhooks/lemlist`, заголовок `X-Webhook-Secret: <LEMLIST_WEBHOOK_SECRET>`.
- **Stripe**: webhook регистрируется автоматически при старте по `APP_BASE_URL` (если задан `STRIPE_SECRET_KEY`).

## 6. Обновление приложения

```bash
cd draftfly-ai-reply-agent
git pull
cd deploy
docker compose build app
docker compose --profile setup run --rm migrate   # если менялась схема БД
docker compose up -d
```

## Отладка

| Симптом | Причина / решение |
|---|---|
| После входа через Slack снова кидает на /login | Проверьте, что заходите по HTTPS-домену из `APP_BASE_URL` (cookie `secure` + `sameSite`), и что `SESSION_SECRET` не менялся |
| `redirect_uri did not match` от Slack | Redirect URL в настройках Slack-приложения не совпадает с `APP_BASE_URL` + `/api/auth/slack/callback` |
| 403 «workspace is not authorized» | Пользователь из чужого Slack-воркспейса — проверьте `SLACK_TEAM_ID` |
| Карточки не приходят в Slack | Проверьте `SLACK_BOT_TOKEN` и что бот приглашён в канал клиента |
| 401 на Lemlist webhook | Заголовок `X-Webhook-Secret` не совпадает с `LEMLIST_WEBHOOK_SECRET` |
