import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfiles, useUpdateProfile, useUpdateUserRole, type ProfileWithRole } from "@/hooks/useProfiles";
import { useMatters } from "@/hooks/useMatters";
import { useAssignments, useCreateAssignment, useDeleteAssignment } from "@/hooks/useAssignments";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Users, UserPlus, Trash2, Search, Loader2, Key, Download, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import type { UserRole } from "@/types";
import { exportCollaboratorsCSV } from "@/lib/exports";
import { validatePassword, getPasswordErrorMessage } from "@/lib/password";
import { PasswordRequirements } from "@/components/PasswordRequirements";
import { useClients } from "@/hooks/useClients";
import { useClientUsers, useSetClientUsers } from "@/hooks/useClientUsers";
import { Checkbox } from "@/components/ui/checkbox";
import { useClientUserMatters, useSetClientUserMatters } from "@/hooks/useClientUserMatters";
export default function Collaborators() {
  const { role } = useAuth();
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ProfileWithRole | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // User form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<UserRole>("collaborator");
  const [formRateCents, setFormRateCents] = useState("");
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedMatterIds, setSelectedMatterIds] = useState<Record<string, string[]>>({});
  const [expandedClients, setExpandedClients] = useState<string[]>([]);

  // Assignment form state
  const [assignMatterId, setAssignMatterId] = useState("");
  const [assignStartDate, setAssignStartDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Password reset state
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState<string>("");
  const [passwordUserName, setPasswordUserName] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Delete collaborator state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteTargetUser, setDeleteTargetUser] = useState<ProfileWithRole | null>(null);
  const [isDeletingCollaborator, setIsDeletingCollaborator] = useState(false);

  // Hooks for data
  const { data: profiles = [], isLoading: profilesLoading } = useProfiles();
  const { data: matters = [], isLoading: mattersLoading } = useMatters();
  const { data: assignments = [], isLoading: assignmentsLoading } = useAssignments();
  const { data: clients = [] } = useClients();
  const { data: allClientUsers = [] } = useClientUsers();
  const { data: allClientUserMatters = [] } = useClientUserMatters();
  const setClientUsers = useSetClientUsers();
  const setClientUserMatters = useSetClientUserMatters();
  const updateProfile = useUpdateProfile();
  const updateUserRole = useUpdateUserRole();
  const createAssignment = useCreateAssignment();
  const deleteAssignment = useDeleteAssignment();

  const filteredUsers = profiles.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (role !== "owner" && role !== "sysadmin") {
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
    setFormName("");
    setFormEmail("");
    setFormRole("collaborator");
    setFormRateCents("");
    setEditingUser(null);
    setSelectedClientIds([]);
    setSelectedMatterIds({});
    setExpandedClients([]);
  };

  const openUserDialog = (u?: ProfileWithRole) => {
    if (u) {
      setEditingUser(u);
      setFormName(u.name);
      setFormEmail(u.email);
      setFormRole(u.role || "collaborator");
      setFormRateCents(u.rate_cents ? String(u.rate_cents / 100) : "");
      // Pre-load client associations
      const userClientIds = allClientUsers
        .filter((cu) => cu.user_id === u.id)
        .map((cu) => cu.client_id);
      setSelectedClientIds(userClientIds);
      // Pre-load matter associations
      const matterMap: Record<string, string[]> = {};
      allClientUserMatters
        .filter((cum) => cum.user_id === u.id)
        .forEach((cum) => {
          if (!matterMap[cum.client_id]) matterMap[cum.client_id] = [];
          matterMap[cum.client_id].push(cum.matter_id);
        });
      setSelectedMatterIds(matterMap);
      setExpandedClients(userClientIds);
    } else {
      resetUserForm();
    }
    setIsUserDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!formName.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }

    let rateCents: number | null = null;
    if (formRateCents) {
      const parsed = parseFloat(formRateCents);
      if (isNaN(parsed) || parsed < 0) {
        toast.error("Le taux horaire doit être un nombre positif");
        return;
      }
      rateCents = Math.round(parsed * 100);
    }

    try {
      if (editingUser) {
        // Update existing user
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

        // Save client associations
        if (formRole === 'client') {
          await setClientUsers.mutateAsync({ userId: editingUser.id, clientIds: selectedClientIds });
          await setClientUserMatters.mutateAsync({ userId: editingUser.id, mattersByClient: selectedMatterIds });
        } else if ((editingUser.role as string) === 'client') {
          // Role changed away from client, remove associations
          await setClientUsers.mutateAsync({ userId: editingUser.id, clientIds: [] });
          await setClientUserMatters.mutateAsync({ userId: editingUser.id, mattersByClient: {} });
        }

        toast.success("Utilisateur modifié");
      } else {
        // Create new user
        if (!formEmail.trim()) {
          toast.error("L'email est obligatoire");
          return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formEmail.trim())) {
          toast.error("Format d'email invalide");
          return;
        }

        setIsCreatingUser(true);

        // Generate a cryptographically random password for the new user
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        const tempPassword = Array.from(array, b => b.toString(36).padStart(2, '0')).join('').slice(0, 16) + "A1!";

        // Create user via Supabase Auth (requires edge function with admin privileges)
        const { data, error } = await supabase.functions.invoke("admin-create-user", {
          body: {
            email: formEmail.trim(),
            password: tempPassword,
            name: formName.trim(),
            role: formRole,
            rateCents: rateCents,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        // Save client associations for new user
        if (formRole === 'client' && data?.userId && selectedClientIds.length > 0) {
          await setClientUsers.mutateAsync({ userId: data.userId, clientIds: selectedClientIds });
          await setClientUserMatters.mutateAsync({ userId: data.userId, mattersByClient: selectedMatterIds });
        }

        toast.success(`Utilisateur créé. Un email d'invitation a été envoyé à ${formEmail.trim()}`);
      }

      setIsUserDialogOpen(false);
      resetUserForm();
    } catch (error: any) {
      console.error("Error saving user:", error);
      toast.error(error.message || "Erreur lors de la sauvegarde");
    } finally {
      setIsCreatingUser(false);
    }
  };

  const toggleUserActive = async (u: ProfileWithRole) => {
    try {
      await updateProfile.mutateAsync({
        id: u.id,
        active: !u.active,
      });
      toast.success(u.active ? "Utilisateur désactivé" : "Utilisateur activé");
    } catch (error) {
      toast.error("Erreur lors de la modification");
      console.error(error);
    }
  };

  const openAssignDialog = (userId: string) => {
    setSelectedUserId(userId);
    setAssignMatterId("");
    setAssignStartDate(new Date().toISOString().split("T")[0]);
    setIsAssignDialogOpen(true);
  };

  const handleSaveAssignment = async () => {
    if (!assignMatterId) {
      toast.error("Veuillez sélectionner un dossier");
      return;
    }

    try {
      await createAssignment.mutateAsync({
        matter_id: assignMatterId,
        user_id: selectedUserId,
        start_date: assignStartDate,
        end_date: null,
      });
      toast.success("Affectation créée");
      setIsAssignDialogOpen(false);
    } catch (error) {
      toast.error("Erreur lors de la création de l'affectation");
      console.error(error);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    try {
      await deleteAssignment.mutateAsync(assignmentId);
      toast.success("Affectation supprimée");
    } catch (error) {
      toast.error("Erreur lors de la suppression");
      console.error(error);
    }
  };

  const handleDeleteCollaborator = async () => {
    if (!deleteTargetUser) return;
    setIsDeletingCollaborator(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { userId: deleteTargetUser.id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Utilisateur supprimé avec succès");
      setIsDeleteDialogOpen(false);
      setDeleteTargetUser(null);
      window.location.reload();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erreur lors de la suppression de l'utilisateur");
    } finally {
      setIsDeletingCollaborator(false);
    }
  };

  const openPasswordDialog = (userId: string, userName: string) => {
    setPasswordUserId(userId);
    setPasswordUserName(userName);
    setNewPassword("");
    setConfirmPassword("");
    setIsPasswordDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error("Veuillez remplir les deux champs");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }

    if (!validatePassword(newPassword).isValid) {
      toast.error(getPasswordErrorMessage('fr'));
      return;
    }

    setIsResettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-reset-password", {
        body: { userId: passwordUserId, newPassword },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Mot de passe modifié pour ${passwordUserName}`);
      setIsPasswordDialogOpen(false);
    } catch (error: any) {
      console.error("Password reset error:", error);
      toast.error(error.message || "Erreur lors de la modification du mot de passe");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const getUserAssignments = (userId: string) => {
    return assignments.filter((a) => a.user_id === userId);
  };

  const getMatterLabel = (matterId: string) => {
    const matter = matters.find((m) => m.id === matterId);
    return matter ? `${matter.code} - ${matter.label}` : "Inconnu";
  };

  const formatCents = (cents: number) => {
    return new Intl.NumberFormat("fr-MA", {
      style: "currency",
      currency: "MAD",
    }).format(cents / 100);
  };

  const roleLabels: Record<UserRole, string> = {
    sysadmin: "Sysadmin",
    owner: "Associé",
    assistant: "Assistant",
    collaborator: "Collaborateur",
    client: "Client",
  };

  const roleColors: Record<UserRole, string> = {
    sysadmin: "bg-destructive text-destructive-foreground",
    owner: "bg-accent text-accent-foreground",
    assistant: "bg-primary text-primary-foreground",
    collaborator: "bg-secondary text-secondary-foreground",
    client: "bg-muted text-muted-foreground",
  };

  const openMatters = matters.filter((m) => m.status === "open");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('collaborators.title')}</h1>
          <p className="text-muted-foreground">{t('collaborators.subtitle')}</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              exportCollaboratorsCSV(
                profiles.map((p) => ({
                  email: p.email,
                  name: p.name,
                  role: p.role || "collaborator",
                  rateCents: p.rate_cents,
                  active: p.active,
                })),
              );
              toast.success("Export CSV téléchargé");
            }}
            disabled={profiles.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => openUserDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvel utilisateur
          </Button>
        </div>

        <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingUser ? "Modifier l'utilisateur" : "Nouvel utilisateur"}</DialogTitle>
              <DialogDescription>
                {editingUser
                  ? "Modifiez les informations et le rôle de l'utilisateur."
                  : "Créez un nouveau compte utilisateur. Un email d'invitation sera envoyé."}
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
                <Label htmlFor="email">Email {!editingUser && "*"}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="utilisateur@example.com"
                  value={editingUser ? editingUser.email : formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  disabled={!!editingUser}
                  className={editingUser ? "bg-muted" : ""}
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
                      <SelectItem value="client">Client</SelectItem>
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

              {/* Client selector - only visible when role is 'client' */}
              {formRole === 'client' && (
                <div className="grid gap-2">
                  <Label>Clients et dossiers associés *</Label>
                  <div className="border rounded-md p-3 max-h-64 overflow-y-auto space-y-1">
                    {clients.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucun client disponible</p>
                    ) : (
                      clients.map((client) => {
                        const isClientSelected = selectedClientIds.includes(client.id);
                        const isExpanded = expandedClients.includes(client.id);
                        const clientMatters = matters.filter((m) => m.client_id === client.id);
                        const selectedForClient = selectedMatterIds[client.id] || [];

                        return (
                          <div key={client.id}>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={isClientSelected}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedClientIds((prev) => [...prev, client.id]);
                                    setExpandedClients((prev) => [...prev, client.id]);
                                  } else {
                                    setSelectedClientIds((prev) => prev.filter((id) => id !== client.id));
                                    setExpandedClients((prev) => prev.filter((id) => id !== client.id));
                                    setSelectedMatterIds((prev) => {
                                      const next = { ...prev };
                                      delete next[client.id];
                                      return next;
                                    });
                                  }
                                }}
                              />
                              <button
                                type="button"
                                className="flex items-center gap-1 text-sm font-medium hover:underline"
                                onClick={() => {
                                  if (isClientSelected) {
                                    setExpandedClients((prev) =>
                                      isExpanded ? prev.filter((id) => id !== client.id) : [...prev, client.id]
                                    );
                                  }
                                }}
                              >
                                {isClientSelected && clientMatters.length > 0 && (
                                  isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
                                )}
                                {client.name}
                              </button>
                              {selectedForClient.length > 0 && (
                                <Badge variant="secondary" className="text-xs">{selectedForClient.length} dossier(s)</Badge>
                              )}
                            </div>

                            {isClientSelected && isExpanded && clientMatters.length > 0 && (
                              <div className="ml-8 mt-1 mb-2 space-y-1 border-l pl-3">
                                {clientMatters.map((matter) => (
                                  <label key={matter.id} className="flex items-center gap-2 cursor-pointer">
                                    <Checkbox
                                      checked={selectedForClient.includes(matter.id)}
                                      onCheckedChange={(checked) => {
                                        setSelectedMatterIds((prev) => {
                                          const current = prev[client.id] || [];
                                          return {
                                            ...prev,
                                            [client.id]: checked
                                              ? [...current, matter.id]
                                              : current.filter((id) => id !== matter.id),
                                          };
                                        });
                                      }}
                                    />
                                    <span className="text-sm">{matter.code} – {matter.label}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                            {isClientSelected && isExpanded && clientMatters.length === 0 && (
                              <p className="ml-8 mt-1 mb-2 text-xs text-muted-foreground">Aucun dossier pour ce client</p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUserDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleSaveUser}
                disabled={updateProfile.isPending || updateUserRole.isPending || isCreatingUser}
              >
                {(updateProfile.isPending || updateUserRole.isPending || isCreatingUser) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingUser ? "Enregistrer" : "Créer"}
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
            <DialogDescription>Affectez un dossier à cet utilisateur.</DialogDescription>
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
                    <div className="p-2 text-sm text-muted-foreground text-center">Aucun dossier ouvert disponible</div>
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
            <Button onClick={handleSaveAssignment} disabled={createAssignment.isPending || !assignMatterId}>
              {createAssignment.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Affecter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog - Sysadmin only */}
      {role === "sysadmin" && (
        <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Modifier le mot de passe</DialogTitle>
              <DialogDescription>Définissez un nouveau mot de passe pour {passwordUserName}.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Mot de passe sécurisé"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <PasswordRequirements password={newPassword} lang="fr" />
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
              <Button onClick={handleResetPassword} disabled={isResettingPassword || !newPassword || !confirmPassword}>
                {isResettingPassword && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Modifier
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Collaborator Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Supprimer le collaborateur</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer le collaborateur <strong>{deleteTargetUser?.name}</strong> ? Cette
              action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDeleteCollaborator} disabled={isDeletingCollaborator}>
              {isDeletingCollaborator && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                          {u.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{u.name}</span>
                          {u.role && <Badge className={roleColors[u.role]}>{roleLabels[u.role]}</Badge>}
                          {!u.active && <Badge variant="secondary">Inactif</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{u.email}</p>
                        {u.rate_cents && (
                          <p className="text-xs text-muted-foreground">Taux: {formatCents(u.rate_cents)}/h</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => openAssignDialog(u.id)}>
                        <UserPlus className="w-4 h-4 mr-1" />
                        Affecter
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openUserDialog(u)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {role === "sysadmin" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openPasswordDialog(u.id, u.name)}
                          title="Modifier le mot de passe"
                        >
                          <Key className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => toggleUserActive(u)}>
                        {u.active ? "Désactiver" : "Activer"}
                      </Button>
                      {role === "sysadmin" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeleteTargetUser(u);
                            setIsDeleteDialogOpen(true);
                          }}
                          title="Supprimer le collaborateur"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
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
