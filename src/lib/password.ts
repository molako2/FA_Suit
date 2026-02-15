export interface PasswordValidationResult {
  isValid: boolean;
  rules: PasswordRule[];
}

export interface PasswordRule {
  key: string;
  label: { fr: string; en: string };
  passed: boolean;
}

/**
 * Validates a password against complexity requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export function validatePassword(password: string): PasswordValidationResult {
  const rules: PasswordRule[] = [
    {
      key: 'minLength',
      label: { fr: 'Au moins 8 caractères', en: 'At least 8 characters' },
      passed: password.length >= 8,
    },
    {
      key: 'uppercase',
      label: { fr: 'Au moins une lettre majuscule', en: 'At least one uppercase letter' },
      passed: /[A-Z]/.test(password),
    },
    {
      key: 'lowercase',
      label: { fr: 'Au moins une lettre minuscule', en: 'At least one lowercase letter' },
      passed: /[a-z]/.test(password),
    },
    {
      key: 'number',
      label: { fr: 'Au moins un chiffre', en: 'At least one number' },
      passed: /[0-9]/.test(password),
    },
    {
      key: 'special',
      label: { fr: 'Au moins un caractère spécial (!@#$...)', en: 'At least one special character (!@#$...)' },
      passed: /[^A-Za-z0-9]/.test(password),
    },
  ];

  return {
    isValid: rules.every((r) => r.passed),
    rules,
  };
}

/**
 * Returns a localized error message for an invalid password.
 */
export function getPasswordErrorMessage(lang: string): string {
  return lang === 'fr'
    ? 'Le mot de passe ne respecte pas les critères de sécurité requis'
    : 'The password does not meet the required security criteria';
}
