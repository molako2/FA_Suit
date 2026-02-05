import { useState } from 'react';
import { useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Eye, EyeOff, Globe } from 'lucide-react';
import { toast } from 'sonner';
import cm2aBanner from '@/assets/cm2a-banner.png';
import appLogo from '@/assets/flowassist-logo.png';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  
  // Get current language code (handle full locale like 'fr-FR' -> 'fr')
  const currentLanguage = useMemo(() => {
    const lang = i18n.language || 'fr';
    return lang.split('-')[0];
  }, [i18n.language]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    const { error } = await signIn(email, password);
    
    if (error) {
      toast.error(error.message || t('auth.loginError'));
    } else {
      toast.success(t('auth.loginSuccess'));
      navigate('/');
    }
    
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) return;

    if (password.length < 6) {
      toast.error(t('errors.fillRequired'));
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(email, password, name);
    
    if (error) {
      if (error.message.includes('already registered')) {
        toast.error(t('auth.signUpError'));
      } else {
        toast.error(error.message || t('auth.signUpError'));
      }
    } else {
      toast.success(t('auth.signUpSuccess'));
    }
    
    setIsLoading(false);
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Language Selector */}
      <div className="absolute top-4 right-4 z-10 flex flex-col items-end">
        <Select value={currentLanguage} onValueChange={changeLanguage}>
          <SelectTrigger className="w-[140px] bg-card border-2 border-red-500">
            <Globe className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fr">{t('auth.french')}</SelectItem>
            <SelectItem value="en">{t('auth.english')}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          {currentLanguage === 'fr' ? 'Sélectionner votre langue' : 'Select your language'}
        </p>
      </div>

      {/* CM2A Banner */}
      <a 
        href="https://www.cm2a.ma" 
        target="_blank" 
        rel="noopener noreferrer"
        className="w-full flex justify-center py-4 bg-background hover:opacity-90 transition-opacity"
      >
        <img 
          src={cm2aBanner} 
          alt="CM2A Consulting" 
          className="h-16 md:h-20 object-contain"
        />
      </a>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
        {/* Logo & Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-32 h-32 rounded-xl bg-white border border-border overflow-hidden">
            <img src={appLogo} alt="FlowAssist" className="w-full h-full object-cover scale-125" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">FlowAssist</h1>
          <p className="text-muted-foreground">{i18n.language === 'fr' ? 'Suite de Gestion Intégrée - version 1.0' : 'Integrated Management Suite - version 1.0'}</p>
        </div>

        {/* Auth Card */}
        <Card className="border-border shadow-lg">
          <Tabs defaultValue="signin" className="w-full">
            <CardHeader className="space-y-1">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">{t('auth.signIn')}</TabsTrigger>
                <TabsTrigger value="signup">{t('auth.signUp')}</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">{t('auth.email')}</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder={i18n.language === 'fr' ? 'vous@cabinet.fr' : 'you@firm.com'}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">{t('auth.password')}</Label>
                    <div className="relative">
                      <Input
                        id="signin-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        className="h-11 pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-11 px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11"
                    disabled={isLoading || !email || !password}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        {t('common.loading')}
                      </>
                    ) : (
                      t('auth.signIn')
                    )}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">{t('auth.fullName')}</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder={i18n.language === 'fr' ? 'Marie Dupont' : 'John Doe'}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">{t('auth.email')}</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder={i18n.language === 'fr' ? 'vous@cabinet.fr' : 'you@firm.com'}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">{t('auth.password')}</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        className="h-11 pr-10"
                        minLength={6}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-11 px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {i18n.language === 'fr' ? 'Minimum 6 caractères' : 'Minimum 6 characters'}
                    </p>
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11"
                    disabled={isLoading || !email || !password || !name}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        {t('common.loading')}
                      </>
                    ) : (
                      t('auth.createAccount')
                    )}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          {i18n.language === 'fr' ? "En vous inscrivant, vous acceptez nos conditions d'utilisation." : 'By signing up, you agree to our terms of use.'}
        </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full py-4 text-center border-t border-border bg-card">
        <p className="text-sm text-muted-foreground">
          {i18n.language === 'fr' ? 'Développé par l\'équipe' : 'Developed by'} <span className="font-semibold">CM2A Consulting™</span> - {i18n.language === 'fr' ? 'Votre partenaire de réussite' : 'Your success partner'} - {' '}
          <a 
            href="https://www.cm2a.ma" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            www.cm2a.ma
          </a>
        </p>
      </footer>
    </div>
  );
}
