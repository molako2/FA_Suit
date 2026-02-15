import { Check, X } from 'lucide-react';
import { validatePassword } from '@/lib/password';

interface PasswordRequirementsProps {
  password: string;
  lang: string;
}

export function PasswordRequirements({ password, lang }: PasswordRequirementsProps) {
  const { rules } = validatePassword(password);

  if (!password) return null;

  return (
    <ul className="space-y-1 mt-1.5">
      {rules.map((rule) => (
        <li key={rule.key} className="flex items-center gap-1.5 text-xs">
          {rule.passed ? (
            <Check className="w-3 h-3 text-green-600 shrink-0" />
          ) : (
            <X className="w-3 h-3 text-destructive shrink-0" />
          )}
          <span className={rule.passed ? 'text-green-600' : 'text-muted-foreground'}>
            {lang === 'fr' ? rule.label.fr : rule.label.en}
          </span>
        </li>
      ))}
    </ul>
  );
}
