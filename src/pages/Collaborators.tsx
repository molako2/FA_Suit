import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProfiles, useUpdateProfile, useUpdateUserRole, type ProfileWithRole } from '@/hooks/useProfiles';
import { useMatters } from '@/hooks/useMatters';
import { useAssignments, useCreateAssignment, useDeleteAssignment } from '@/hooks/useAssignments';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Pencil, Users, UserPlus, Trash2, Search, Loader2, Key } from 'lucide-react';
import { toast } from 'sonner';
import type { UserRole } from '@/types';

export default function Collaborators() {
  const { role } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ProfileWithRole | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // User form state
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('collaborator');
  const [formRateCents, setFormRateCents] = useState('');

  // Assignment form state
  const [assignMatterId, setAssignMatterId] = useState('');
  const [assignStartDate, setAssignStartDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Password reset state
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState<string>('');
  const [passwordUserName, setPasswordUserName] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Hooks for data
  const { data: profiles = [], isLoading: profilesLoading } = useProfiles();
  const { data: matters = [], isLoading: mattersLoading } = useMatters();
  const { data: assignments = [], isLoading: assignmentsLoading } = useAssignments();
  const updateProfile = useUpdateProfile();
  const updateUserRole = useUpdateUserRole();
  const createAssignment = useCreateAssignment();
  const deleteAssignment = useDeleteAssignment();

  const filteredUsers = profiles.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (role !== 'owner' && role !== 'sysadmin') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Accès réservé aux associés.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoading = profilesLoading || mattersLoading || assignmentsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const resetUserForm = () => {
    setFormName('');
    setFormRole('collaborator');
    setFormRateCents('');
    setEditingUser(null);
  };

  const openUserDialog = (u?: ProfileWithRole) => {
    if (u) {
      setEditingUser(u);
      setFormName(u.name);
      setFormRole(u.role || 'collaborator');
      setFormRateCents(u.rate_cents ? String(u.rate_cents / 100) : '');
    } else {
      resetUserForm();
    }
    setIsUserDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    
    if (!formName.trim()) {
      toast.error('Le nom est obligatoire');
      return;
    }

    const rateCents = formRateCents ? Math.round(parseFloat(formRateCents) * 100) : null;

    try {
      // Update profile
      await updateProfile.mutateAsync({
        id: editingUser.id,
        name: formName.trim(),
        rate_cents: rateCents,
      });

      // Update role if changed
      if (formRole !== editingUser.role) {
        await updateUserRole.mutateAsync({
          userId: editingUser.id,
          role: formRole,
        });
      }

      toast.success('Utilisateur modifié');
      setIsUserDialogOpen(false);
      resetUserForm();
    } catch (error) {
      toast.error('Erreur lors de la modification');
      console.error(error);
    }
  };

  const toggleUserActive = async (u: ProfileWithRole) => {
    try {
      await updateProfile.mutateAsync({
        id: u.id,
        active: !u.active,
      });
      toast.success(u.active ? 'Utilisateur désactivé' : 'Utilisateur activé');
    } catch (error) {
      toast.error('Erreur lors de la modification');
      console.error(error);
    }
  };

  const openAssignDialog = (userId: string) => {
    setSelectedUserId(userId);
    setAssignMatterId('');
    setAssignStartDate(new Date().toISOString().split('T')[0]);
    setIsAssignDialogOpen(true);
  };

  const handleSaveAssignment = async () => {
    if (!assignMatterId) {
      toast.error('Veuillez sélectionner un dossier');
      return;
    }

    try {
      await createAssignment.mutateAsync({
        matter_id: assignMatterId,
        user_id: selectedUserId,
        start_date: assignStartDate,
        end_date: null,
      });
      toast.success('Affectation créée');
      setIsAssignDialogOpen(false);
    } catch (error) {
      toast.error('Erreur lors de la création de l\'affectation');
      console.error(error);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    try {
      await deleteAssignment.mutateAsync(assignmentId);
      toast.success('Affectation supprimée');
    } catch (error) {
      toast.error('Erreur lors de la suppression');
      console.error(error);
    }
  };

  const openPasswordDialog = (userId: string, userName: string) => {
    setPasswordUserId(userId);
    setPasswordUserName(userName);
    setNewPassword('');
    setConfirmPassword('');
    setIsPasswordDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Veuillez remplir les deux champs');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setIsResettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: { userId: passwordUserId, newPassword },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Mot de passe modifié pour ${passwordUserName}`);
      setIsPasswordDialogOpen(false);
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast.error(error.message || 'Erreur lors de la modification du mot de passe');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const getUserAssignments = (userId: string) => {
    return assignments.filter(a => a.user_id === userId);
  };

  const getMatterLabel = (matterId: string) => {
    const matter = matters.find(m => m.id === matterId);
    return matter ? `${matter.code} - ${matter.label}` : 'Inconnu';
  };

  const formatCents = (cents: number) => {
    return new Intl.NumberFormat('fr-MA', {
      style: 'currency',
      currency: 'MAD',
    }).format(cents / 100);
  };

  const roleLabels: Record<UserRole, string> = {
    sysadmin: 'Sysadmin',
    owner: 'Associé',
    assistant: 'Assistant',
    collaborator: 'Collaborateur',
  };

  const roleColors: Record<UserRole, string> = {
    sysadmin: 'bg-destructive text-destructive-foreground',
    owner: 'bg-accent text-accent-foreground',
    assistant: 'bg-primary text-primary-foreground',
    collaborator: 'bg-secondary text-secondary-foreground',
  };

  const openMatters = matters.filter(m => m.status === 'open');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Collaborateurs</h1>
          <p className="text-muted-foreground">Gestion des utilisateurs et affectations</p>
        </div>

        <Button onClick={() => openUserDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvel utilisateur
        </Button>

        <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Modifier l'utilisateur</DialogTitle>
              <DialogDescription>
                Modifiez les informations et le rôle de l'utilisateur.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nom *</Label>
                <Input
                  id="name"
                  placeholder="Prénom Nom"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label>Email</Label>
                <Input
                  value={editingUser?.email || ''}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="role">Rôle</Label>
                  <Select value={formRole} onValueChange={(v) => setFormRole(v as UserRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sysadmin">Sysadmin</SelectItem>
                      <SelectItem value="owner">Associé</SelectItem>
                      <SelectItem value="assistant">Assistant</SelectItem>
                      <SelectItem value="collaborator">Collaborateur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="rate">Taux horaire (MAD)</Label>
                  <Input
                    id="rate"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Ex: 120.00"
                    value={formRateCents}
                    onChange={(e) => setFormRateCents(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUserDialogOpen(false)}>
                Annuler
              </Button>
              <Button 
                onClick={handleSaveUser}
                disabled={updateProfile.isPending || updateUserRole.isPending}
              >
                {(updateProfile.isPending || updateUserRole.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un utilisateur..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Assignment Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Nouvelle affectation</DialogTitle>
            <DialogDescription>
              Affectez un dossier à cet utilisateur.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="matter">Dossier</Label>
              <Select value={assignMatterId} onValueChange={setAssignMatterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un dossier" />
                </SelectTrigger>
                <SelectContent>
                  {openMatters.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      Aucun dossier ouvert disponible
                    </div>
                  ) : (
                    openMatters.map((matter) => (
                      <SelectItem key={matter.id} value={matter.id}>
                        {matter.code} - {matter.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="startDate">Date de début</Label>
              <Input
                id="startDate"
                type="date"
                value={assignStartDate}
                onChange={(e) => setAssignStartDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleSaveAssignment}
              disabled={createAssignment.isPending || !assignMatterId}
            >
              {createAssignment.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Affecter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog - Sysadmin only */}
      {role === 'sysadmin' && (
        <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Modifier le mot de passe</DialogTitle>
              <DialogDescription>
                Définissez un nouveau mot de passe pour {passwordUserName}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Au moins 6 caractères"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Répétez le mot de passe"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
                Annuler
              </Button>
              <Button 
                onClick={handleResetPassword}
                disabled={isResettingPassword || !newPassword || !confirmPassword}
              >
                {isResettingPassword && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Modifier
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Users List */}
      <div className="space-y-4">
        {filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Aucun utilisateur trouvé</p>
            </CardContent>
          </Card>
        ) : (
          filteredUsers.map((u) => {
            const userAssignments = getUserAssignments(u.id);
            return (
              <Card key={u.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {u.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{u.name}</span>
                          {u.role && (
                            <Badge className={roleColors[u.role]}>{roleLabels[u.role]}</Badge>
                          )}
                          {!u.active && <Badge variant="secondary">Inactif</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{u.email}</p>
                        {u.rate_cents && (
                          <p className="text-xs text-muted-foreground">
                            Taux: {formatCents(u.rate_cents)}/h
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAssignDialog(u.id)}
                      >
                        <UserPlus className="w-4 h-4 mr-1" />
                        Affecter
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openUserDialog(u)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {role === 'sysadmin' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openPasswordDialog(u.id, u.name)}
                          title="Modifier le mot de passe"
                        >
                          <Key className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleUserActive(u)}
                      >
                        {u.active ? 'Désactiver' : 'Activer'}
                      </Button>
                    </div>
                  </div>

                  {/* Assignments */}
                  {userAssignments.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm font-medium mb-2">Dossiers affectés:</p>
                      <div className="flex flex-wrap gap-2">
                        {userAssignments.map((a) => (
                          <Badge key={a.id} variant="outline" className="flex items-center gap-1">
                            {getMatterLabel(a.matter_id)}
                            <button
                              onClick={() => handleDeleteAssignment(a.id)}
                              className="ml-1 hover:text-destructive"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
