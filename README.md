# CS2 Tournaments

Веб-приложение для организации и ведения турниров по Counter-Strike 2:
турнирные сетки, live-матчи, медиа-галерея, составы команд и роли админа/зрителя.

## Что уже реализовано

- **Турнирные форматы:** Single Elimination, Double Elimination, Группы → Плей-офф.
- **Live-режим матчей:** карты, счёт по картам BO1/BO3/BO5, время старта live.
- **Главная и архив:** карточки турниров с фильтрами (поиск, формат, статус, размер команд).
- **Составы команд:** хранение ростеров и отдельный блок просмотра/редактирования.
- **Медиа турнира:** фото/видео, серверное сжатие изображений, превью для фото и видео.
- **Шеринг:** кнопки «Поделиться» для турнира и live-матчей.

## Стек
- **Nuxt 4** + **Vue 3** (`<script setup>`, Composition API)
- **Tailwind CSS v4**
- **MySQL** + **Drizzle ORM**
- **nuxt-auth-utils** (сессии админа), **bcryptjs**

## Запуск

```bash
npm install
npm run dev
```

Открой http://localhost:3000

### Вход администратора
- Логин: `admin`
- Пароль: `admin123`

## База данных

Настройки берутся из `.env`:

```
DB_HOST=...
DB_USER=...
DB_PASSWORD=...
DB_NAME=...
NUXT_SESSION_PASSWORD=<длинная случайная строка>
NUXT_PUBLIC_SITE_URL=https://example.com
```

> **Важно.** Хостинг beget обычно разрешает подключение к MySQL только изнутри своей
> сети. Поэтому **локально** база напрямую недоступна — приложение автоматически
> переключается на встроенное **демо-хранилище в памяти** (те же демо-данные, все
> действия работают, но сбрасываются при перезапуске). **На сервере beget**, где база
> доступна, используется реальный MySQL.

### Инициализация реальной БД (на хостинге или при доступе к MySQL)

```bash
npm run db:push    # создать таблицы по схеме
npm run db:seed    # заполнить демо-данными (админ admin/admin123, турниры)
```

## Структура

```
app/
  components/     # AppLogo, BracketView, MatchCard, TournamentCard, StatusBadge
  layouts/        # default.vue — шапка, навигация, подвал
  pages/          # index, archive, tournaments/[id], admin/login, admin/index
  middleware/     # admin.ts — защита админ-раздела
  utils/          # labels.ts — подписи форматов/статусов
  assets/css/     # main.css — тема Tailwind
server/
  api/            # REST-эндпоинты (tournaments, matches, auth)
  db/             # schema.ts (Drizzle), seed.ts
  utils/          # repo.ts (MySQL/in-memory), bracket*.ts, auth.ts, db.ts
```

## Логотип
Положи `logo.webp` в папку `public/` — он появится в шапке, подвале и на входе.
Пока файла нет, показывается встроенный SVG-плейсхолдер.

## SEO

- Публичные страницы используют `canonical`, Open Graph и Twitter meta.
- Для турниров добавлена Schema.org-разметка (`SportsEvent`).
- Для главной и архива добавлена schema-разметка (`WebSite`, `CollectionPage`).
- Доступны:
  - `GET /robots.txt`
  - `GET /sitemap.xml` (включает главную, архив и страницы турниров)
- Админка и API закрыты от индексации через `meta robots` и `X-Robots-Tag`.

## Форматы сеток
Поддерживаются все основные форматы:

- **Single Elimination**
- **Double Elimination**
- **Группы → Плей-офф** (с последующим посевом в playoff-сетку)

Логика генерации и прогрессии сетки находится в `server/utils/formats/`.
