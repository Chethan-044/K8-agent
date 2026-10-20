export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class KubernetesError extends AppError {
  constructor(message: string, statusCode: number = 502) {
    super(`Kubernetes: ${message}`, statusCode);
  }
}

export class GeminiError extends AppError {
  constructor(message: string, statusCode: number = 502) {
    super(`Gemini: ${message}`, statusCode);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}
