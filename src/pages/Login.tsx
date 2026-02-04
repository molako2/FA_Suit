import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Clock, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    
    // Simulate magic link delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const success = await login(email);
    
    if (success) {
      toast.success('Connexion réussie');
      navigate('/');
    } else {
      // For demo: show link sent message even if email not found (security)
      setLinkSent(true);
      toast.info('Si ce compte existe, un lien de connexion a été envoyé.');
    }
    
    setIsLoading(false);
  };

  // Demo quick login buttons
  const quickLogin = async (email: string) => {
    setIsLoading(true);
    await login(email);
    setIsLoading(false);
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo & Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-primary text-primary-foreground">
            <Clock className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">FlowAssist</h1>
          <p className="text-muted-foreground">Gestion du temps facturable</p>
        </div>

        {/* Login Card */}
        <Card className="border-border shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Connexion</CardTitle>
            <CardDescription>
              Entrez votre email pour recevoir un lien de connexion sécurisé
            </CardDescription>
          </CardHeader>
          <CardContent>
            {linkSent ? (
              <div className="text-center py-8 space-y-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/20">
                  <Mail className="w-6 h-6 text-accent" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold">Vérifiez votre boîte mail</h3>
                  <p className="text-sm text-muted-foreground">
                    Si un compte existe pour <strong>{email}</strong>, vous recevrez un lien de connexion.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setLinkSent(false)}
                  className="mt-4"
                >
                  Retour
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email professionnel</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="vous@cabinet.fr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-11"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={isLoading || !email}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Envoyer le lien de connexion
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Demo Quick Access */}
        <Card className="border-dashed border-2 border-muted">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Démo — Connexion rapide
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => quickLogin('associe@cabinet.fr')}
              disabled={isLoading}
            >
              <span className="w-2 h-2 rounded-full bg-accent mr-2" />
              Associé (Owner) — Marie Dupont
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => quickLogin('assistant@cabinet.fr')}
              disabled={isLoading}
            >
              <span className="w-2 h-2 rounded-full bg-primary mr-2" />
              Assistant — Jean Martin
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => quickLogin('collaborateur@cabinet.fr')}
              disabled={isLoading}
            >
              <span className="w-2 h-2 rounded-full bg-muted-foreground mr-2" />
              Collaborateur — Sophie Bernard
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
