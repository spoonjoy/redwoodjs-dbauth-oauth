declare type PublicMembers<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? T[K] extends { accessibility: 'private' }
      ? never
      : K
    : K
}[keyof T]
