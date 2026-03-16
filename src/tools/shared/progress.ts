export interface ProgressNotificationSender {
  notification: (notification: {
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

  await sender.notification({
    method: "notifications/progress",
    params: {
      progressToken: token,
      progress,
      total: 1,
      message,
    },
  });
}
