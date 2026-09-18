export interface ProgressNotificationSender {
  notify: (notify: {
    method: "notifications/progress";
    params: {
      progressToken: string | number;
      progress: number;
      total: number;
      message: string;
    };
  }) => Promise<void>;
}

export function asProgressToken(
  value: unknown,
): string | number | undefined {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }

  return undefined;
}

export async function sendProgressNotification(
  sender: ProgressNotificationSender,
  progressToken: unknown,
  progress: number,
  message: string,
): Promise<void> {
  const token = asProgressToken(progressToken);
  if (token === undefined) {
    return;
  }

  await sender.notify({
    method: "notifications/progress",
    params: {
      progressToken: token,
      progress,
      total: 1,
      message,
    },
  });
}
