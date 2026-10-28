/** Thrown by a job handler whose module has not been implemented yet. */
export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`${feature} todavía no está disponible`);
    this.name = "NotImplementedError";
  }
}
