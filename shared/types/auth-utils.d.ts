// Описываем данные сессии для nuxt-auth-utils (иначе user типизирован как {}).
// Лежит в shared/types — эта папка входит в include tsconfig и для app, и для server.
declare module '#auth-utils' {
  interface User {
    id: number
    username: string
    role: 'admin'
  }
}

export {}
