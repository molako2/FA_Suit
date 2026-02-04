import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getUsers,
  getMatters,
  getAssignments,
  saveUser,
  saveAssignment,
  deleteAssignment,
  generateId,
  formatCents,
} from '@/lib/storage';
import { Plus, Pencil, Users, UserPlus, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { User, Assignment, UserRole } from '@/types';

export default function Collaborators() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // User form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('collaborator');
  const [formRateCents, setFormRateCents] = useState('');

  // Assignment form state
  const [assignMatterId, setAssignMatterId] = useState('');
  const [assignStartDate, setAssignStartDate] = useState(() => new Date().toISOString().split('T')[0]);

  const users = getUsers();
  const matters = getMatters();
  const assignments = getAssignments();

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (user?.role !== 'owner' && user?.role !== 'sysadmin') {
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

  const resetUserForm = () => {
    setFormName('');
    setFormEmail('');
    setFormRole('collaborator');
    setFormRateCents('');
    setEditingUser(null);
  };

  const openUserDialog = (u?: User) => {
    if (u) {
      setEditingUser(u);
      setFormName(u.name);
      setFormEmail(u.email);
      setFormRole(u.role);
      setFormRateCents(u.rateCents ? String(u.rateCents / 100) : '');
    } else {
      resetUserForm();
    }
    setIsUserDialogOpen(true);
  };

  const handleSaveUser = () => {
    if (!formName.trim() || !formEmail.trim()) {
      toast.error('Nom et email sont obligatoires');
      return;
    }

    const rateCents = formRateCents ? Math.round(parseFloat(formRateCents) * 100) : undefined;

    const newUser: User = {
      id: editingUser?.id || generateId(),
      email: formEmail.trim(),
      name: formName.trim(),
      role: formRole,
      active: editingUser?.active ?? true,
      createdAt: editingUser?.createdAt || new Date().toISOString(),
      rateCents: rateCents || undefined,
    };

    saveUser(newUser);
    toast.success(editingUser ? 'Utilisateur modifié' : 'Utilisateur créé');
    setIsUserDialogOpen(false);
    resetUserForm();
  };

  const toggleUserActive = (u: User) => {
    saveUser({ ...u, active: !u.active });
    toast.success(u.active ? 'Utilisateur désactivé' : 'Utilisateur activé');
  };

  const openAssignDialog = (userId: string) => {
    setSelectedUserId(userId);
    setAssignMatterId('');
    setAssignStartDate(new Date().toISOString().split('T')[0]);
    setIsAssignDialogOpen(true);
  };

  const handleSaveAssignment = () => {
    if (!assignMatterId) {
      toast.error('Veuillez sélectionner un dossier');
      return;
    }

    const assignment: Assignment = {
      id: generateId(),
      matterId: assignMatterId,
      userId: selectedUserId,
      startDate: assignStartDate,
    };

    saveAssignment(assignment);
    toast.success('Affectation créée');
    setIsAssignDialogOpen(false);
  };

  const handleDeleteAssignment = (assignmentId: string) => {
    deleteAssignment(assignmentId);
    toast.success('Affectation supprimée');
  };

  const getUserAssignments = (userId: string) => {
    return assignments.filter(a => a.userId === userId);
  };

  const getMatterLabel = (matterId: string) => {
    const matter = matters.find(m => m.id === matterId);
    return matter ? `${matter.code} - ${matter.label}` : 'Inconnu';
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Collaborateurs</h1>
          <p className="text-muted-foreground">Gestion des utilisateurs et affectations</p>
        </div>

        <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openUserDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Nouvel utilisateur
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}</DialogTitle>
              <DialogDescription>
                Définissez les informations et le rôle de l'utilisateur.
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
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="utilisateur@cabinet.fr"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
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
              <Button onClick={handleSaveUser}>
                {editingUser ? 'Enregistrer' : 'Créer'}
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
                  {matters.filter(m => m.status === 'open').map((matter) => (
                    <SelectItem key={matter.id} value={matter.id}>
                      {matter.code} - {matter.label}
                    </SelectItem>
                  ))}
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
            <Button onClick={handleSaveAssignment}>
              Affecter
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
                          {u.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{u.name}</span>
                          <Badge className={roleColors[u.role]}>{roleLabels[u.role]}</Badge>
                          {!u.active && <Badge variant="secondary">Inactif</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{u.email}</p>
                        {u.rateCents && (
                          <p className="text-xs text-muted-foreground">
                            Taux: {formatCents(u.rateCents)}/h
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
                            {getMatterLabel(a.matterId)}
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
