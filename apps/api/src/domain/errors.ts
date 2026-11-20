export class AppError extends Error {
  constructor(
    public code: string,
    public status = 400,
    message = "요청을 처리하지 못했어요. 다시 확인해주세요.",
  ) {
    super(message);
  }
}
export function ensure(
  condition: unknown,
  code: string,
  status = 400,
  message?: string,
): asserts condition {
  if (!condition) throw new AppError(code, status, message);
}
