import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import flowassistLogo from '@/assets/flowassist-logo.png';

export function WelcomeCard() {
  const { profile } = useAuth();
  const { currentTenant } = useTenant();

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <Card className="max-w-2xl w-full bg-gradient-to-br from-primary/5 via-background to-accent/5 shadow-[0_12px_40px_-12px_hsl(var(--primary)/0.18)]">
        <CardContent className="flex flex-col items-center text-center px-14 py-14 gap-6">
          <img src={flowassistLogo} alt="FlowAssist" className="h-16 object-contain" />

          <div className="space-y-2">
            <p className="text-2xl font-bold">
              Bienvenue,{' '}
              <span className="text-primary">{profile?.name || '...'}</span>
            </p>
            <p className="text-lg font-semibold text-muted-foreground">
              sur <Badge className="ml-1 text-sm bg-primary/10 text-primary border-0 font-bold">FlowAssist 1.0</Badge>
            </p>
            <p className="text-sm font-medium text-muted-foreground/70">Votre suite de gestion intégrée</p>
          </div>

          <Separator className="w-2/3 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

          <p className="text-base font-semibold text-muted-foreground">
            Vous êtes connecté sur l'espace du cabinet{' '}
            <span className="text-accent font-bold">{currentTenant?.name || '...'}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
