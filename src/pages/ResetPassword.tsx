import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import appLogo from '@/assets/flowassist-logo.png';

export default function ResetPasswordPage() {
  const { i18n } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { updatePassword, session } = useAuth();
  const navigate = useNavigate();

  // Check if user has a valid recovery session
  useEffect(() => {
    if (!session) {
      // Give some time for the session to be established from the URL token
      const timer = setTimeout(() => {
        if (!session) {
          toast.error(i18n.language === 'fr' 
            ? 'Lien de réinitialisation invalide ou expiré' 
            : 'Invalid or expired reset link');
          navigate('/login');
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [session, navigate, i18n.language]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 6) {
      toast.error(i18n.language === 'fr' 
        ? 'Le mot de passe doit contenir au moins 6 caractères' 
        : 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error(i18n.language === 'fr' 
        ? 'Les mots de passe ne correspondent pas' 
        : 'Passwords do not match');
      return;
    }

    setIsLoading(true);
    const { error } = await updatePassword(password);
    
    if (error) {
      toast.error(error.message || (i18n.language === 'fr' 
        ? 'Erreur lors de la modification du mot de passe' 
        : 'Error updating password'));
    } else {
      setIsSuccess(true);
      toast.success(i18n.language === 'fr' 
        ? 'Mot de passe modifié avec succès' 
        : 'Password updated successfully');
      
      // Redirect to login after a short delay
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    }
    
    setIsLoading(false);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border shadow-lg">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-16 h-16 mx-auto text-success mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {i18n.language === 'fr' ? 'Mot de passe modifié !' : 'Password updated!'}
            </h2>
            <p className="text-muted-foreground">
              {i18n.language === 'fr' 
                ? 'Vous allez être redirigé vers la page de connexion...' 
                : 'You will be redirected to the login page...'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-xl bg-white border border-border overflow-hidden">
            <img src={appLogo} alt="FlowAssist" className="w-full h-full object-cover scale-125" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">FlowAssist</h1>
        </div>

        <Card className="border-border shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">
              {i18n.language === 'fr' ? 'Nouveau mot de passe' : 'New password'}
            </CardTitle>
            <CardDescription>
              {i18n.language === 'fr' 
                ? 'Entrez votre nouveau mot de passe' 
                : 'Enter your new password'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">
                  {i18n.language === 'fr' ? 'Nouveau mot de passe' : 'New password'}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
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

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  {i18n.language === 'fr' ? 'Confirmer le mot de passe' : 'Confirm password'}
                </Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-11"
                  minLength={6}
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11"
                disabled={isLoading || !password || !confirmPassword}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {i18n.language === 'fr' ? 'Modification...' : 'Updating...'}
                  </>
                ) : (
                  i18n.language === 'fr' ? 'Modifier le mot de passe' : 'Update password'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
