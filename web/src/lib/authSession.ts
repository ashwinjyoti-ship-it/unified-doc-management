const BLANK_PAGE_KEY = 'openBlankPage';
const LAST_EMAIL_KEY = 'lastAuthEmail';

export function markOpenBlankPageAfterAuth() {
  sessionStorage.setItem(BLANK_PAGE_KEY, '1');
}

export function consumeOpenBlankPageAfterAuth(): boolean {
  if (sessionStorage.getItem(BLANK_PAGE_KEY) !== '1') return false;
  sessionStorage.removeItem(BLANK_PAGE_KEY);
  return true;
}

export function saveLastAuthEmail(email: string) {
  localStorage.setItem(LAST_EMAIL_KEY, email);
}

export function getLastAuthEmail(): string {
  return localStorage.getItem(LAST_EMAIL_KEY) || '';
}
