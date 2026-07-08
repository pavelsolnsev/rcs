import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
  mysqlEnum,
  boolean,
  json,
} from 'drizzle-orm/mysql-core'
import { relations } from 'drizzle-orm'

/** Форматы турнирной сетки. Расширяемо — добавляй новые значения по мере надобности. */
export const BRACKET_FORMATS = [
  'single_elimination',
  'double_elimination',
  'groups_playoff',
] as const

/** Формат команд. */
export const TEAM_SIZES = ['1x1', '2x2', '5x5'] as const

/** Статус турнира. */
export const TOURNAMENT_STATUS = ['draft', 'ongoing', 'finished'] as const

/** Статус матча. */
export const MATCH_STATUS = ['pending', 'live', 'finished'] as const

/** Результат одной карты внутри матча. */
export interface MapResult {
  map: string | null
  scoreA: number
  scoreB: number
}

/** Игрок в составе команды. */
export interface TeamPlayer {
  nickname: string
  role?: 'captain' | 'player'
  steamId?: string | null
}

// ---------- Администраторы ----------
export const adminUsers = mysqlTable('admin_users', {
  id: int('id').autoincrement().primaryKey(),
  username: varchar('username', { length: 64 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ---------- Турниры ----------
export const tournaments = mysqlTable('tournaments', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  format: mysqlEnum('format', BRACKET_FORMATS).notNull().default('single_elimination'),
  teamSize: mysqlEnum('team_size', TEAM_SIZES).notNull().default('5x5'),
  status: mysqlEnum('status', TOURNAMENT_STATUS).notNull().default('draft'),
  championTeamId: int('champion_team_id'),
  // Формат матчей по стадиям (best-of): 1 / 3 / 5
  boGroups: int('bo_groups').notNull().default(1),
  boMain: int('bo_main').notNull().default(1),
  boFinal: int('bo_final').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  finishedAt: timestamp('finished_at'),
})

// ---------- Команды/участники ----------
export const teams = mysqlTable('teams', {
  id: int('id').autoincrement().primaryKey(),
  tournamentId: int('tournament_id').notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  logoUrl: varchar('logo_url', { length: 255 }),
  roster: json('roster').$type<TeamPlayer[]>(),
  seed: int('seed'), // посев (номер в сетке)
})

// ---------- Матчи ----------
export const matches = mysqlTable('matches', {
  id: int('id').autoincrement().primaryKey(),
  tournamentId: int('tournament_id').notNull(),
  // Раздел сетки: winners / losers (для double elimination) / group / playoff
  bracket: varchar('bracket', { length: 20 }).notNull().default('winners'),
  round: int('round').notNull(), // номер раунда (1 = первый раунд)
  position: int('position').notNull(), // позиция матча внутри раунда (0..n)
  teamAId: int('team_a_id'),
  teamBId: int('team_b_id'),
  scoreA: int('score_a').notNull().default(0),
  scoreB: int('score_b').notNull().default(0),
  // Формат матча: best-of (1 / 3 / 5) — счёт трактуется как выигранные карты
  bestOf: int('best_of').notNull().default(1),
  // Результаты по картам: [{ map, scoreA, scoreB }] (длина до bestOf)
  maps: json('maps').$type<MapResult[]>(),
  status: mysqlEnum('status', MATCH_STATUS).notNull().default('pending'),
  winnerTeamId: int('winner_team_id'),
  // Куда двигать победителя: id следующего матча + слот ('a' | 'b')
  nextMatchId: int('next_match_id'),
  nextSlot: varchar('next_slot', { length: 1 }),
  // Куда двигать проигравшего (для Double Elimination — в сетку лузеров)
  loserNextMatchId: int('loser_next_match_id'),
  loserNextSlot: varchar('loser_next_slot', { length: 1 }),
  // Метка группы для группового этапа ('A', 'B', ...); null для плей-офф
  groupLabel: varchar('group_label', { length: 10 }),
  // Подпись матча для отображения ('Гранд-финал', 'LB Раунд 1' и т.п.)
  label: varchar('label', { length: 60 }),
})

// ---------- Медиа (фото/видео турнира) ----------
export const MEDIA_TYPES = ['photo', 'video'] as const

export const media = mysqlTable('media', {
  id: int('id').autoincrement().primaryKey(),
  tournamentId: int('tournament_id').notNull(),
  type: mysqlEnum('type', MEDIA_TYPES).notNull(),
  // URL картинки (photo) или ссылка на видео YouTube/VK/прямой файл (video)
  url: varchar('url', { length: 500 }).notNull(),
  // Уменьшенное превью для сетки (для загруженных фото); null → используем url
  thumbUrl: varchar('thumb_url', { length: 500 }),
  caption: varchar('caption', { length: 200 }),
  sortOrder: int('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ---------- Связи ----------
export const tournamentsRelations = relations(tournaments, ({ many }) => ({
  teams: many(teams),
  matches: many(matches),
  media: many(media),
}))

export const mediaRelations = relations(media, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [media.tournamentId],
    references: [tournaments.id],
  }),
}))

export const teamsRelations = relations(teams, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [teams.tournamentId],
    references: [tournaments.id],
  }),
}))

export const matchesRelations = relations(matches, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [matches.tournamentId],
    references: [tournaments.id],
  }),
}))

export type Tournament = typeof tournaments.$inferSelect
export type Team = typeof teams.$inferSelect
export type Match = typeof matches.$inferSelect
export type Media = typeof media.$inferSelect
export type AdminUser = typeof adminUsers.$inferSelect
