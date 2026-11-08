import React, { useState } from 'react';
import { User, UserRole } from '../types/marisma';
import {
  UserCheck,
  Plus,
  Shield,
  Edit2,
  Trash2,
  X,
  Save,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  KeyRound,
} from 'lucide-react';

interface UsersViewProps {
  users: User[];
  currentUser: User;
  onSaveUser: (user: User & { password?: string }) => Promise<void> | void;
  onDeleteUser: (userId: string) => void;
  onSelectUserToLogin: (user: User) => void;
}

export const UsersView: React.FC<UsersViewProps> = ({
  users,
  currentUser,
  onSaveUser,
  onDeleteUser,
  onSelectUserToLogin,
}) => {
  // Defensa en profundidad: Si un usuario que no es ADMINISTRADOR intenta acceder a este componente, no renderizar nada
  if (currentUser.rol !== 'ADMINISTRADOR') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center text-amber-800 font-bold">
        Acceso restringido únicamente a administradores del sistema.
      </div>
    );
  }

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isModalOpen && !userToDelete) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isModalOpen, userToDelete]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleEdit = (u: User) => {
    setSelectedUser(u);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedUser(null);
    setIsModalOpen(true);
  };

  const handlePromptDelete = (u: User) => {
    setUserToDelete(u);
  };

  const handleConfirmDelete = (u: User) => {
    const userName = u.nombreCompleto;
    onDeleteUser(u.id);
    setUserToDelete(null);
    showToast(`Usuario "${userName}" eliminado correctamente del sistema.`);
  };

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-800 text-white px-4 py-3 rounded-xl shadow-lg flex items-center justify-between text-xs sm:text-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-300 shrink-0" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-emerald-700 rounded text-emerald-200 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                GESTIÓN DE USUARIOS Y PERMISOS
              </h1>
              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-300">
                {users.length} {users.length === 1 ? 'Cuenta' : 'Cuentas'}
              </span>
            </div>
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#008744] hover:bg-[#00743a] text-white text-sm font-bold rounded-lg shadow-sm transition"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span>NUEVO USUARIO</span>
          </button>
        </div>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((u) => {
          const isCurrent = u.id === currentUser.id;
          const isOnlyUser = users.length <= 1;

          return (
            <div
              key={u.id}
              className={`bg-white rounded-xl shadow-xs border p-5 transition flex flex-col justify-between ${
                isCurrent ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-700 text-white font-black text-sm flex items-center justify-center border border-emerald-500 shadow-xs">
                      {u.avatarInitials}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 leading-tight">
                        {u.nombreCompleto}
                      </h3>
                      <p className="text-xs text-gray-500 font-mono">@{u.username}</p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      u.rol === 'ADMINISTRADOR'
                        ? 'bg-purple-100 text-purple-900 border border-purple-300'
                        : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    }`}
                  >
                    {u.rol === 'ADMINISTRADOR' ? 'ADMINISTRADOR' : 'SOLO LECTURA'}
                  </span>
                </div>

                <div className="text-xs text-gray-600 space-y-1 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                  <p>
                    <strong>Cargo:</strong> {u.cargo}
                  </p>
                  <p>
                    <strong>Email:</strong> {u.email}
                  </p>
                </div>
              </div>

              <div className="pt-3 mt-4 border-t border-gray-100 flex items-center justify-between">
                {isCurrent ? (
                  <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    <span>Sesión actual</span>
                  </span>
                ) : (
                  <button
                    onClick={() => onSelectUserToLogin(u)}
                    className="text-xs text-emerald-700 hover:text-emerald-900 font-bold hover:underline"
                  >
                    Cambiar a esta cuenta →
                  </button>
                )}

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(u)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                    title="Editar usuario"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handlePromptDelete(u)}
                    className={`p-1.5 rounded transition ${
                      isOnlyUser
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-400 hover:text-rose-600 hover:bg-rose-50'
                    }`}
                    title={
                      isOnlyUser
                        ? 'No se puede eliminar el único usuario del sistema'
                        : `Eliminar a ${u.nombreCompleto}`
                    }
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* User Create/Edit Modal */}
      {isModalOpen && (
        <UserEditModal
          user={selectedUser}
          existingUsers={users}
          onClose={() => setIsModalOpen(false)}
          onSave={async (u) => {
            try {
              await onSaveUser(u);
              setIsModalOpen(false);
              showToast(`Usuario "${u.nombreCompleto}" guardado correctamente.`);
            } catch {
              // El error ya se alertó en App.tsx
            }
          }}
          onDelete={(userId) => {
            const user = users.find((item) => item.id === userId);
            setIsModalOpen(false);
            if (user) {
              handlePromptDelete(user);
            }
          }}
        />
      )}

      {/* User Delete Confirmation Modal */}
      {userToDelete && (
        <UserDeleteModal
          user={userToDelete}
          isCurrentUser={userToDelete.id === currentUser.id}
          canDelete={users.length > 1}
          nextUser={users.find((u) => u.id !== userToDelete.id)}
          onClose={() => setUserToDelete(null)}
          onConfirm={() => handleConfirmDelete(userToDelete)}
        />
      )}
    </div>
  );
};

interface UserDeleteModalProps {
  user: User;
  isCurrentUser: boolean;
  canDelete: boolean;
  nextUser?: User;
  onClose: () => void;
  onConfirm: () => void;
}

const UserDeleteModal: React.FC<UserDeleteModalProps> = ({
  user,
  isCurrentUser,
  canDelete,
  nextUser,
  onClose,
  onConfirm,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overscroll-contain">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-rose-700 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-rose-800 flex items-center justify-center text-rose-100">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold">Eliminar Usuario</h2>
              <p className="text-xs text-rose-200">Revocación de cuenta del censo ganadero</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-rose-200 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4 text-xs sm:text-sm overflow-y-auto overscroll-contain flex-1">
          {/* User Card Summary */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-emerald-800 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
              {user.avatarInitials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-gray-900 truncate">{user.nombreCompleto}</h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-800 uppercase shrink-0">
                  {user.rol.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-gray-500 font-mono">@{user.username}</p>
              <p className="text-[11px] text-gray-600 truncate mt-0.5">{user.cargo} · {user.email}</p>
            </div>
          </div>

          {!canDelete ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-xl space-y-1">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>No es posible eliminar este usuario</span>
              </div>
              <p className="text-xs text-amber-700 leading-relaxed">
                Esta es la única cuenta registrada en el sistema. Para eliminar este usuario, primero crea o registra otro usuario que mantenga el acceso a la aplicación.
              </p>
            </div>
          ) : (
            <>
              {isCurrentUser && (
                <div className="bg-amber-50 border border-amber-300 text-amber-900 p-3.5 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-amber-800">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>Estás eliminando tu propia sesión actual</span>
                  </div>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Al confirmar la eliminación, tu sesión activa finalizará y cambiará automáticamente a la cuenta de <strong>{nextUser?.nombreCompleto || 'otro usuario registrado'}</strong>.
                  </p>
                </div>
              )}

              <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                ¿Estás seguro de que deseas eliminar permanentemente a <strong>{user.nombreCompleto}</strong>? Esta acción no se puede deshacer y el usuario perderá el acceso a la plataforma.
              </p>
            </>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 transition"
            >
              Cancelar
            </button>

            {canDelete ? (
              <button
                type="button"
                onClick={onConfirm}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-sm transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sí, Eliminar Usuario</span>
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="px-4 py-2 bg-gray-200 text-gray-400 font-bold rounded-lg cursor-not-allowed"
              >
                Acción no permitida
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface UserEditModalProps {
  user: User | null;
  existingUsers: User[];
  onClose: () => void;
  onSave: (u: User & { password?: string }) => void;
  onDelete?: (userId: string) => void;
}

const UserEditModal: React.FC<UserEditModalProps> = ({ user, existingUsers, onClose, onSave, onDelete }) => {
  const [username, setUsername] = useState(user?.username || '');
  const [nombreCompleto, setNombreCompleto] = useState(user?.nombreCompleto || '');
  const [rol, setRol] = useState<UserRole>(user?.rol === 'ADMINISTRADOR' ? 'ADMINISTRADOR' : 'CONSULTA');
  const [cargo, setCargo] = useState(user?.cargo || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().toLowerCase();
    const cleanName = nombreCompleto.trim();

    if (!cleanUser || !cleanName) {
      alert('Nombre de usuario y nombre completo son obligatorios');
      return;
    }

    // Validación preventiva en cliente de username duplicado
    const isDuplicate = existingUsers.some(
      (u) => u.username.toLowerCase() === cleanUser && u.id !== user?.id
    );
    if (isDuplicate) {
      alert(`El nombre de usuario "${cleanUser}" ya está en uso por otra cuenta. Por favor elija un nombre de usuario diferente.`);
      return;
    }

    if (!user && !password.trim()) {
      alert('La contraseña es obligatoria para nuevos usuarios');
      return;
    }

    if (password.trim() && password.trim().length < 12) {
      alert('La contraseña debe tener al menos 12 caracteres');
      return;
    }

    const initials = nombreCompleto
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const saved: User & { password?: string } = {
      id: user?.id || `user-${Date.now()}`,
      username: username.trim().toLowerCase(),
      nombreCompleto: nombreCompleto.trim(),
      rol,
      cargo: cargo.trim() || 'Personal Municipal',
      email: email.trim(),
      avatarInitials: initials || 'US',
      activo: true,
      ...(password.trim() ? { password: password.trim() } : {}),
    };
    onSave(saved);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overscroll-contain">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95">
        <div className="bg-[#0b5333] text-white px-5 py-4 flex items-center justify-between shrink-0">
          <h2 className="text-base font-bold">
            {user ? 'Editar Usuario' : 'Nuevo Usuario del Sistema'}
          </h2>
          <button onClick={onClose} className="p-1 rounded text-emerald-200 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3 text-xs sm:text-sm overflow-y-auto overscroll-contain flex-1">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Nombre Completo *</label>
            <input
              type="text"
              value={nombreCompleto}
              onChange={(e) => setNombreCompleto(e.target.value)}
              placeholder="ej. Manuel Ramos Garrido"
              className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Usuario (Login) *</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ej. manuel.ramos"
              className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              {user ? 'Cambiar Contraseña (opcional)' : 'Contraseña Inicial *'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={user ? 'Dejar en blanco para mantener la actual' : 'Mínimo 12 caracteres'}
              className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              required={!user}
              minLength={user ? 0 : 6}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Rol / Permisos *</label>
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value as any)}
              className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ADMINISTRADOR">👑 Administrador (Acceso Total: Creación, Modificación, Eliminación y Ajustes)</option>
              <option value="CONSULTA">🔍 Solo Lectura (Consulta del Censo y Fichas sin permisos de modificación)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Cargo / Puesto</label>
            <input
              type="text"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="ej. Guarda Rural Titular"
              className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Correo Electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@hinojos.es"
              className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
            {user && onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(user.id)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Usuario</span>
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 bg-[#008744] hover:bg-[#00743a] text-white font-bold rounded-lg shadow-xs transition"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Usuario</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
