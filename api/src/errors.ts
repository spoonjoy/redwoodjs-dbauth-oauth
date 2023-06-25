/** Right from dbAuth */
export class NoUserIdError extends Error {
  constructor() {
    super(
      'loginHandler() must return an object with an `id` field as set in `authFields.id`'
    )
    this.name = 'NoUserIdError'
  }
}
