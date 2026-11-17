import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, User, AlertCircle, Stethoscope, Sparkles, KeyRound } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog } from '../components/ui/dialog';
import { useAuth } from '../hooks/useAuth';
import { api, ApiException } from '../lib/api';
export function LoginScreen() {
    const { login, updateUser } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    // Dev quick accounts
    const [devAccounts, setDevAccounts] = useState([]);
    // Forced password change modal
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
    const [currentUsername, setCurrentUsername] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changePasswordError, setChangePasswordError] = useState(null);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [pendingAuthResponse, setPendingAuthResponse] = useState(null);
    // Load dev accounts if in dev environment
    useEffect(() => {
        api.get('/auth/dev-accounts')
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
    const routeByRole = (role) => {
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
    const handleLoginSubmit = async (e, customUser, customPass) => {
        if (e)
            e.preventDefault();
        const loginUsername = (customUser || username).trim();
        const loginPassword = customPass || password;
        if (!loginUsername || !loginPassword) {
            setError('يرجى إدخال اسم المستخدم وكلمة المرور');
            return;
        }
        setError(null);
        setIsLoading(true);
        try {
            const res = await api.post('/auth/login', {
                username: loginUsername,
                password: loginPassword,
            });
            login(res);
            if (res.user.mustChangePassword) {
                setPendingAuthResponse(res);
                setCurrentUsername(res.user.username);
                setCurrentPassword(loginPassword);
                setShowChangePasswordModal(true);
            }
            else {
                routeByRole(res.user.role);
            }
        }
        catch (err) {
            if (err instanceof ApiException) {
                setError(err.message);
            }
            else {
                setError('تعذر تسجيل الدخول. يرجى التحقق من صحة البيانات.');
            }
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleChangePasswordSubmit = async (e) => {
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
            }
            else {
                window.location.href = '/reception';
            }
        }
        catch (err) {
            setChangePasswordError(err.message || 'حدث خطأ أثناء تغيير كلمة المرور');
        }
        finally {
            setIsChangingPassword(false);
        }
    };
    return (_jsxs("div", { className: "min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 flex flex-col justify-center items-center p-4 selection:bg-sky-500 selection:text-white", children: [_jsx("div", { className: "absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-500/10 rounded-full blur-3xl pointer-events-none" }), _jsxs("div", { className: "w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl border border-slate-100 relative z-10 space-y-6", children: [_jsxs("div", { className: "text-center space-y-2", children: [_jsx("div", { className: "w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/30", children: _jsx(Stethoscope, { className: "w-8 h-8" }) }), _jsx("h1", { className: "text-2xl font-black text-slate-900", children: "\u0646\u0638\u0627\u0645 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u064A\u0627\u062F\u0629 \u0627\u0644\u0637\u0628\u064A\u0629" }), _jsx("p", { className: "text-xs text-slate-500 font-medium", children: "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u0644\u0645\u0648\u0638\u0641\u064A\u0646 \u0648\u0627\u0644\u0637\u0627\u0642\u0645 \u0627\u0644\u0637\u0628\u064A" })] }), error && (_jsxs("div", { className: "p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2", children: [_jsx(AlertCircle, { className: "w-4 h-4 flex-shrink-0" }), _jsx("span", { children: error })] })), _jsxs("form", { onSubmit: (e) => handleLoginSubmit(e), className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645" }), _jsxs("div", { className: "relative", children: [_jsx(Input, { type: "text", value: username, onChange: (e) => setUsername(e.target.value), placeholder: "\u0623\u062F\u062E\u0644 \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645...", required: true, className: "pr-9" }), _jsx(User, { className: "w-4 h-4 text-slate-400 absolute top-3 right-3" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631" }), _jsxs("div", { className: "relative", children: [_jsx(Input, { type: showPassword ? 'text' : 'password', value: password, onChange: (e) => setPassword(e.target.value), placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", required: true, className: "pr-9 pl-9" }), _jsx(Lock, { className: "w-4 h-4 text-slate-400 absolute top-3 right-3" }), _jsx("button", { type: "button", onClick: () => setShowPassword(!showPassword), className: "absolute top-3 left-3 text-slate-400 hover:text-slate-600", children: showPassword ? _jsx(EyeOff, { className: "w-4 h-4" }) : _jsx(Eye, { className: "w-4 h-4" }) })] })] }), _jsx(Button, { type: "submit", variant: "primary", disabled: isLoading, className: "w-full py-2.5 text-sm font-bold shadow-md bg-sky-600 hover:bg-sky-700", children: isLoading ? 'جاري التحقق...' : 'تسجيل الدخول' })] }), devAccounts.length > 0 && (_jsxs("div", { className: "pt-4 border-t border-slate-100 space-y-2", children: [_jsx("div", { className: "flex items-center justify-between text-xs text-slate-500 font-semibold", children: _jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Sparkles, { className: "w-3.5 h-3.5 text-amber-500" }), "\u062D\u0633\u0627\u0628\u0627\u062A \u062A\u062C\u0631\u064A\u0628\u064A\u0629 \u0633\u0631\u064A\u0639\u0629 (Dev Mode):"] }) }), _jsx("div", { className: "grid grid-cols-2 gap-2", children: devAccounts.map((acc) => (_jsxs("button", { type: "button", onClick: () => {
                                        const pwd = acc.password || acc.defaultPassword || '';
                                        setUsername(acc.username);
                                        setPassword(pwd);
                                        handleLoginSubmit(undefined, acc.username, pwd);
                                    }, className: "p-2 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-sky-50 hover:border-sky-300 text-right transition-all group", children: [_jsx("div", { className: "font-bold text-slate-800 text-xs group-hover:text-sky-900", children: acc.fullName }), _jsx("div", { className: "text-[10px] text-slate-500 group-hover:text-sky-700", children: acc.description || acc.roleTitleAr || acc.role })] }, acc.username))) })] }))] }), _jsx(Dialog, { isOpen: showChangePasswordModal, onClose: () => { }, title: "\u062A\u063A\u064A\u064A\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0625\u0644\u0632\u0627\u0645\u064A", description: "\u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u064A\u0633\u062A\u062E\u062F\u0645 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629 \u0627\u0644\u0623\u0648\u0644\u064A\u0629. \u0644\u0623\u0645\u0627\u0646 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A\u060C \u064A\u062C\u0628 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u062C\u062F\u064A\u062F\u0629 \u0642\u0628\u0644 \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629.", maxWidth: "sm", children: _jsxs("form", { onSubmit: handleChangePasswordSubmit, className: "space-y-4", children: [changePasswordError && (_jsxs("div", { className: "p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2", children: [_jsx(AlertCircle, { className: "w-4 h-4 flex-shrink-0" }), _jsx("span", { children: changePasswordError })] })), _jsxs("div", { className: "p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs", children: [_jsx("span", { className: "text-slate-500", children: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645: " }), _jsx("strong", { className: "text-slate-800 font-mono", children: currentUsername })] }), _jsx("div", { children: _jsx(Input, { label: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629", type: "password", value: newPassword, onChange: (e) => setNewPassword(e.target.value), required: true, autoFocus: true, placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" }) }), _jsx("div", { children: _jsx(Input, { label: "\u062A\u0623\u0643\u064A\u062F \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629", type: "password", value: confirmPassword, onChange: (e) => setConfirmPassword(e.target.value), required: true, placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" }) }), _jsxs(Button, { type: "submit", variant: "primary", disabled: isChangingPassword, className: "w-full text-xs font-bold", children: [_jsx(KeyRound, { className: "w-4 h-4 ml-1" }), isChangingPassword ? 'جاري الحفظ...' : 'تأكيد كلمة المرور والدخول'] })] }) })] }));
}
