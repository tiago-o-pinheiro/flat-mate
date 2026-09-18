/** Only deliberate domain messages may cross a Server Action boundary. */
export class PublicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicError";
  }
}
