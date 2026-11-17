import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, User, AlertCircle, Stethoscope, Sparkles, KeyRound } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog } from '../components/ui/dialog';
import { useAuth } from '../hooks/useAuth';
import { api, ApiException } from '../lib/api';
import { AuthResponseDto, DevAccountDto } from '../types';

export function LoginScreen() {
  const { login, updateUser } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dev quick accounts
  const [devAccounts, setDevAccounts] = useState<DevAccountDto[]>([]);

  // Forced password change modal
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);
  const [pendingAuthResponse, setPendingAuthResponse] = useState<AuthResponseDto | null>(null);

  // Load dev accounts if in dev environment
  useEffect(() => {
    api.get<DevAccountDto[]>('/auth/dev-accounts')
      .then((data) => {
        if (data && data.length > 0) {
          setDevAccounts(data);
        }
      })
      .catch(() => {
        // Fallback default dev accounts
        setDevAccounts([
          { role: 'Doctor', roleTitleAr: 'طبيب العيادة', username: 'doctor', defaultPassword: 'Password123!', fullName: 'د. أحمد عبد الرحمن' },
          { role: 'Receptionist', roleTitleAr: 'موظف الاستقبال', username: 'reception', defaultPassword: 'Password123!', fullName: 'أ. سارة إبراهيم' },
          { role: 'Nurse', roleTitleAr: 'تمريض العيادة', username: 'nurse', defaultPassword: 'Password123!', fullName: 'م. مروة محمود' },
          { role: 'Admin', roleTitleAr: 'مدير النظام', username: 'admin', defaultPassword: 'Password123!', fullName: 'المدير الإداري' },
        ]);
      });
  }, []);

  const routeByRole = (role: string) => {
    switch (role) {
      case 'Doctor':
      case 'AssistantDoctor':
        window.location.href = '/doctor';
        break;
      case 'Nurse':
        window.location.href = '/nursing';
        break;
      case 'Receptionist':
      case 'Admin':
        window.location.href = '/reception';
        break;
      default:
        window.location.href = '/doctor';
        break;
    }
  };

  const handleLoginSubmit = async (e?: React.FormEvent, customUser?: string, customPass?: string) => {
    if (e) e.preventDefault();
    const loginUsername = (customUser || username).trim();
    const loginPassword = customPass || password;

    if (!loginUsername || !loginPassword) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const res = await api.post<AuthResponseDto>('/auth/login', {
        username: loginUsername,
        password: loginPassword,
      });

      login(res);

      if (res.user.mustChangePassword) {
        setPendingAuthResponse(res);
        setCurrentUsername(res.user.username);
        setCurrentPassword(loginPassword);
        setShowChangePasswordModal(true);
      } else {
        routeByRole(res.user.role);
      }
    } catch (err: any) {
      if (err instanceof ApiException) {
        setError(err.message);
      } else {
        setError('تعذر تسجيل الدخول. يرجى التحقق من صحة البيانات.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setChangePasswordError('يجب ألا تقل كلمة المرور الجديدة عن 6 أحرف أو أرقام');
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangePasswordError('كلمتا المرور غير متطابقتين');
      return;
    }

    setChangePasswordError(null);
    setIsChangingPassword(true);

    try {
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });

      updateUser({ mustChangePassword: false });
      setShowChangePasswordModal(false);

      if (pendingAuthResponse) {
        routeByRole(pendingAuthResponse.user.role);
      } else {
        window.location.href = '/reception';
      }
    } catch (err: any) {
      setChangePasswordError(err.message || 'حدث خطأ أثناء تغيير كلمة المرور');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 flex flex-col justify-center items-center p-4 selection:bg-sky-500 selection:text-white">
      {/* Background radial highlight */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl border border-slate-100 relative z-10 space-y-6">
        {/* Clinic Logo & Brand */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/30">
            <Stethoscope className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">نظام إدارة العيادة الطبية</h1>
          <p className="text-xs text-slate-500 font-medium">تسجيل الدخول للموظفين والطاقم الطبي</p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={(e) => handleLoginSubmit(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">اسم المستخدم</label>
            <div className="relative">
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم..."
                required
                className="pr-9"
              />
              <User className="w-4 h-4 text-slate-400 absolute top-3 right-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="pr-9 pl-9"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute top-3 right-3" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-3 left-3 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={isLoading}
            className="w-full py-2.5 text-sm font-bold shadow-md bg-sky-600 hover:bg-sky-700"
          >
            {isLoading ? 'جاري التحقق...' : 'تسجيل الدخول'}
          </Button>
        </form>

        {/* Dev Quick-Login Grid */}
        {devAccounts.length > 0 && (
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                حسابات تجريبية سريعة (Dev Mode):
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {devAccounts.map((acc) => (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => {
                    const pwd = acc.password || acc.defaultPassword || '';
                    setUsername(acc.username);
                    setPassword(pwd);
                    handleLoginSubmit(undefined, acc.username, pwd);
                  }}
                  className="p-2 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-sky-50 hover:border-sky-300 text-right transition-all group"
                >
                  <div className="font-bold text-slate-800 text-xs group-hover:text-sky-900">
                    {acc.fullName}
                  </div>
                  <div className="text-[10px] text-slate-500 group-hover:text-sky-700">
                    {acc.description || acc.roleTitleAr || acc.role}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Forced Password Change Modal */}
      <Dialog
        isOpen={showChangePasswordModal}
        onClose={() => {}}
        title="تغيير كلمة المرور إلزامي"
        description="هذا الحساب يستخدم كلمة المرور الافتراضية الأولية. لأمان البيانات، يجب تعيين كلمة مرور جديدة قبل المتابعة."
        maxWidth="sm"
      >
        <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
          {changePasswordError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{changePasswordError}</span>
            </div>
          )}

          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
            <span className="text-slate-500">اسم المستخدم: </span>
            <strong className="text-slate-800 font-mono">{currentUsername}</strong>
          </div>

          <div>
            <Input
              label="كلمة المرور الجديدة"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoFocus
              placeholder="••••••••"
            />
          </div>

          <div>
            <Input
              label="تأكيد كلمة المرور الجديدة"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={isChangingPassword}
            className="w-full text-xs font-bold"
          >
            <KeyRound className="w-4 h-4 ml-1" />
            {isChangingPassword ? 'جاري الحفظ...' : 'تأكيد كلمة المرور والدخول'}
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
