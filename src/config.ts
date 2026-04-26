import dotenv from 'dotenv';
dotenv.config();

export function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function requiredCsv(key: string): string[] {
  const val = process.env[key];
  if (!val) return [];

  return val
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export const config = {
  get token() {
    return required('SLACK_BOT_TOKEN');
  },
  get signingSecret() {
    return required('SLACK_SIGNING_SECRET');
  },
  get teamId() {
    return process.env.SLACK_TEAM_ID;
  },
  get appId() {
    return required('SLACK_APP_ID');
  },
  get allowedUserIds() {
    return requiredCsv('SLACK_ALLOWED_USER_IDS');
  },
  get apiPort() {
    return parseInt(process.env.API_PORT || '3457', 10);
  },
};
