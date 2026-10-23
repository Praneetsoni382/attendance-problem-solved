import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  Calendar,
  Check,
  CheckCircle2,
  CircleAlert,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  User,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  FileText,
  Sparkles,
  Lock,
  GraduationCap,
  AlertTriangle,
  Bell,
  ChevronRight,
  Activity,
  Info,
  Clock,
} from "lucide-react";
import {
  registerStudent,
  loginStudent,
} from "../lib/auth-service";
import { resetStudentPassword } from "../lib/firebase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/attendwise-design-system/components/ui/dialog";
import { Button } from "@workspace/attendwise-design-system/components/ui/button";
import { Input } from "@workspace/attendwise-design-system/components/ui/input";
import { Label } from "@workspace/attendwise-design-system/components/ui/label";
import { Alert, AlertDescription } from "@workspace/attendwise-design-system/components/ui/alert";

interface LandingPageProps {
  onAuthSuccess: (user?: any) => void;
}

export function LandingPage({ onAuthSuccess }: LandingPageProps) {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [showDiscrepancyInfo, setShowDiscrepancyInfo] = useState(false);

  // Parallax 3D effect states
  const heroVisualRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const rafId = useRef<number | null>(null);

  // Check prefers-reduced-motion media query
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Smooth mouse move listener with requestAnimationFrame
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || (typeof window !== "undefined" && window.innerWidth < 1024)) {
      return;
    }
    if (!heroVisualRef.current) return;
    const rect = heroVisualRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5; // -0.5 to 0.5

    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      setMousePos({ x, y });
    });
  }, [prefersReducedMotion]);

  const handleMouseEnter = () => {
    if (!prefersReducedMotion && typeof window !== "undefined" && window.innerWidth >= 1024) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setMousePos({ x: 0, y: 0 });
  };

  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfoMsg("");
    setPending(true);
    // Mark session active before authentication calls so any onAuthStateChanged listener recognizes active session
    localStorage.setItem("attendwise_session_active", "true");
    sessionStorage.setItem("attendwise_session_active", "true");
    try {
      if (mode === "signup") {
        const res = await registerStudent(email, password, name);
        if (res.message) setInfoMsg(res.message);
        onAuthSuccess(res.user);
      } else {
        const res = await loginStudent(email, password);
        if (res.message) setInfoMsg(res.message);
        onAuthSuccess(res.user);
      }
    } catch (err: any) {
      localStorage.removeItem("attendwise_session_active");
      sessionStorage.removeItem("attendwise_session_active");
      setError(err?.message || "Authentication failed. Check your credentials.");
    } finally {
      setPending(false);
    }
  };

  const handlePasswordReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    try {
      await resetStudentPassword(resetEmail.trim());
      setResetMsg(`Password reset link sent to ${resetEmail}. Check your inbox.`);
    } catch (err: any) {
      setResetMsg(err?.message?.replace(/^Firebase:\s*/, "") || "Could not send reset email.");
    }
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const focusAuth = (targetMode: "signin" | "signup") => {
    setMode(targetMode);
    const el = document.getElementById("auth-panel");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F5FC] text-slate-900 font-sans antialiased selection:bg-blue-600 selection:text-white flex flex-col justify-between">
      {/* 1. TOP NAV HEADER (Deep Navy #0B1328 Matching Reference Mockup) */}
      <header className="sticky top-0 z-50 bg-[#0B1328] text-white border-b border-[#1A2645] px-4 sm:px-6 lg:px-8 py-3 shrink-0">
        <div className="max-w-[1340px] mx-auto flex items-center justify-between">
          {/* Logo & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white block leading-tight">
                AttendWise
              </span>
              <span className="text-[10px] font-medium text-slate-400 tracking-wider uppercase block">
                Student Attendance Portal
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8">
            <button
              onClick={() => scrollTo("features")}
              className="text-xs font-semibold text-white relative py-1 cursor-pointer transition-colors"
            >
              <span>Features</span>
              <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-cyan-400 rounded-full" />
            </button>
            <button
              onClick={() => scrollTo("features")}
              className="text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              How it Works
            </button>
            <button
              onClick={() => scrollTo("erp-reality")}
              className="text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              ERP Reality
            </button>
          </nav>

          {/* Right Campus Status & Auth Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#14203B] border border-slate-700/60 text-xs text-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>SISTec Gandhinagar · AIDS 3 Sem</span>
            </div>

            <button
              type="button"
              onClick={() => focusAuth("signin")}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:text-white bg-[#14203B] hover:bg-[#1A284A] border border-slate-700/60 transition-all cursor-pointer"
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={() => focusAuth("signup")}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-[#2563EB] hover:bg-blue-600 shadow-sm shadow-blue-500/30 transition-all cursor-pointer active:scale-95"
            >
              Create Account
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative px-4 sm:px-6 lg:px-8 pt-6 pb-8 lg:pt-8 lg:pb-10 overflow-hidden">
        {/* Soft background ambient gradient */}
        <div className="absolute inset-0 pointer-events-none -z-10">
          <div className="absolute top-0 left-0 w-[500px] h-[350px] bg-blue-100/60 blur-[100px]" />
          <div className="absolute top-10 right-0 w-[600px] h-[450px] bg-cyan-50/70 blur-[120px]" />
        </div>

        <div className="max-w-[1340px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Pill, Headline, Subtitle & Dark Slate Auth Card */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            {/* Tagline Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold w-fit mb-4 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>ERP says: all good. Your records say: let's compare.</span>
            </div>

            {/* 3-line Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-black tracking-tight text-[#0f172a] leading-[1.12]">
              Your attendance.
              <br />
              Your records.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-400">
                Your peace of mind.
              </span>
            </h1>

            {/* Subheading */}
            <p className="mt-3 text-sm text-slate-600 leading-relaxed max-w-lg">
              A personal attendance portal for students to track scheduled classes, record attendance, and compare their records against college ERP entries—because the portal isn't always the whole story.
            </p>

            {/* Integrated Dark Navy Auth Card */}
            <div
              id="auth-panel"
              className="mt-6 rounded-2xl bg-[#0B1528] text-white p-5 sm:p-6 shadow-2xl shadow-slate-900/25 border border-slate-800 max-w-md w-full"
            >
              {/* Tab Switcher */}
              <div className="grid grid-cols-2 p-1 bg-[#070D1B] rounded-xl mb-4 border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError("");
                    setInfoMsg("");
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    mode === "signup"
                      ? "bg-[#2563EB] text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Create Account</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError("");
                    setInfoMsg("");
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    mode === "signin"
                      ? "bg-[#2563EB] text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              </div>

              {/* Feedback Alerts */}
              {error && (
                <div className="mb-3 p-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-200 text-xs flex items-center gap-2">
                  <CircleAlert className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {infoMsg && (
                <div className="mb-3 p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{infoMsg}</span>
                </div>
              )}

              {/* Functional Authentication Form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                {mode === "signup" && (
                  <div className="space-y-1">
                    <Label htmlFor="auth-name" className="text-xs font-medium text-slate-300 flex items-center gap-1">
                      <span>↳ Full Name</span>
                    </Label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        id="auth-name"
                        type="text"
                        placeholder="e.g. Praneet Soni"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="bg-[#111C33] border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-blue-500 rounded-xl h-10 text-xs pl-9"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <Label htmlFor="auth-email" className="text-xs font-medium text-slate-300 flex items-center gap-1">
                    <span>College Email</span>
                  </Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      id="auth-email"
                      type="email"
                      placeholder="yourname@college.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-[#111C33] border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-blue-500 rounded-xl h-10 text-xs pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auth-password" className="text-xs font-medium text-slate-300 flex items-center gap-1">
                      <span>Password</span>
                    </Label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => {
                          setResetEmail(email);
                          setResetMsg("");
                          setResetOpen(true);
                        }}
                        className="text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      id="auth-password"
                      type={showPassword ? "text" : "password"}
                      placeholder={mode === "signup" ? "Create a strong password" : "••••••••"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      required
                      className="bg-[#111C33] border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-blue-500 rounded-xl h-10 text-xs pl-9 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-0.5"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Gradient Action Button matching mockup */}
                <button
                  type="submit"
                  disabled={pending}
                  className="w-full mt-2 h-11 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-[#2563EB] to-[#06B6D4] hover:opacity-95 active:scale-[0.99] transition-all shadow-md shadow-blue-500/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {pending ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Authenticating…
                    </span>
                  ) : (
                    <>
                      <span>{mode === "signup" ? "Create Student Account" : "Sign In to Portal"}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Firebase Trust Note */}
              <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>Your data is stored securely in Firebase 🔥</span>
              </div>
            </div>
          </div>

          {/* Right Column: INTERACTIVE 3D PARALLAX HERO COMPOSITION */}
          <div className="lg:col-span-7 relative flex items-center justify-center select-none min-h-[520px] sm:min-h-[580px]">
            {/* Interactive 3D Perspective Stage */}
            <div
              ref={heroVisualRef}
              onMouseMove={handleMouseMove}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              className="relative w-full max-w-[680px] h-[520px] sm:h-[580px] flex items-center justify-center"
              style={{
                perspective: "1200px",
              }}
            >
              {/* Layer 1: Background SISTec Campus Horizon (Depth: 0.5x) */}
              <div
                className="absolute inset-0 rounded-3xl overflow-hidden opacity-90 transition-transform duration-300 ease-out pointer-events-none -z-10"
                style={{
                  transform:
                    isHovered && !prefersReducedMotion
                      ? `translate3d(${mousePos.x * 8}px, ${mousePos.y * 8}px, -20px) scale(1.02)`
                      : "translate3d(0, 0, 0) scale(1)",
                }}
              >
                <div
                  className="w-full h-full bg-cover bg-center filter brightness-[1.03] contrast-[1.02]"
                  style={{
                    backgroundImage: `url('/assets/sistec-campus.png')`,
                    backgroundPosition: "center 30%",
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#F0F5FC] via-[#F0F5FC]/30 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#F0F5FC] via-transparent to-transparent w-1/3" />
              </div>

              {/* Layer 2: Real Student Image in Blue Hoodie (Depth: 1.0x) */}
              <div
                className="relative z-10 transition-transform duration-250 ease-out flex items-center justify-center"
                style={{
                  transform:
                    isHovered && !prefersReducedMotion
                      ? `translate3d(${mousePos.x * 14}px, ${mousePos.y * 14}px, 10px) rotateX(${-mousePos.y * 3}deg) rotateY(${mousePos.x * 3}deg)`
                      : "translate3d(0, 0, 0)",
                  transformStyle: "preserve-3d",
                }}
              >
                <div className="relative w-[280px] sm:w-[330px] rounded-3xl overflow-hidden shadow-2xl shadow-blue-950/20 border border-white/80 bg-white/30 backdrop-blur-2xs">
                  <img
                    src="/assets/student-hero.jpg"
                    alt="Student with smartphone viewing attendance discrepancy"
                    className="w-full h-[450px] sm:h-[510px] object-cover object-top hover:scale-[1.02] transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent pointer-events-none" />
                </div>
              </div>

              {/* Layer 3: Interactive Smartphone Mockup with "ERP DISCREPANCY DETECTED" (Depth: 1.5x) */}
              <div
                className="absolute bottom-8 sm:bottom-12 left-2 sm:left-6 z-30 transition-transform duration-200 ease-out"
                style={{
                  transform:
                    isHovered && !prefersReducedMotion
                      ? `translate3d(${mousePos.x * 26}px, ${mousePos.y * 26}px, 45px) rotateX(${-mousePos.y * 4}deg) rotateY(${mousePos.x * 4}deg)`
                      : "translate3d(0, 0, 0)",
                  transformStyle: "preserve-3d",
                }}
              >
                <div className="w-[230px] sm:w-[260px] bg-[#0B1328] border-[4px] border-slate-800 rounded-[32px] p-3 shadow-2xl shadow-slate-950/50 text-white text-xs">
                  {/* Phone Notch & Header */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[10px] text-slate-400">
                    <div className="flex items-center gap-1 font-bold text-white">
                      <GraduationCap className="w-3.5 h-3.5 text-cyan-400" />
                      <span>AttendWise</span>
                    </div>
                    <div className="relative">
                      <Bell className="w-3.5 h-3.5 text-slate-300" />
                      <span className="w-2 h-2 rounded-full bg-rose-500 absolute -top-0.5 -right-0.5 animate-ping" />
                    </div>
                  </div>

                  {/* PROMINENT INTERACTIVE DISCREPANCY DETECTED BANNER */}
                  <div
                    onClick={() => setShowDiscrepancyInfo(!showDiscrepancyInfo)}
                    className="mb-2.5 p-2 rounded-xl bg-gradient-to-r from-rose-500/25 to-pink-500/20 border border-rose-500/50 text-rose-200 text-[10px] font-extrabold flex items-center justify-between gap-1.5 cursor-pointer hover:bg-rose-500/30 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 animate-bounce" />
                      <span>ERP DISCREPANCY DETECTED</span>
                    </div>
                    <Info className="w-3 h-3 text-rose-300 shrink-0" />
                  </div>

                  {showDiscrepancyInfo && (
                    <div className="mb-2 p-2 rounded-lg bg-rose-950/80 border border-rose-800 text-[9px] text-rose-200 animate-in fade-in duration-200">
                      Personal record: <strong>Present</strong> (09:35 AM).<br />
                      College ERP entry: <span className="text-rose-400 font-bold">Absent / Not Updated</span>.
                    </div>
                  )}

                  {/* Your Records vs ERP Comparison Card */}
                  <div className="bg-slate-900/95 rounded-xl p-2.5 border border-slate-800 mb-2">
                    <div className="text-[10px] text-slate-400 font-semibold mb-1">Your Records vs ERP</div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-[10px] text-slate-300">AttendWise</span>
                        <span className="font-black text-emerald-400 text-xs ml-1">78%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-rose-400" />
                        <span className="text-[10px] text-slate-300">ERP</span>
                        <span className="font-black text-rose-400 text-xs ml-1">62%</span>
                      </div>
                    </div>
                    <div className="text-[9px] text-cyan-400 font-bold flex items-center justify-end gap-1">
                      <span>View Details</span>
                      <ChevronRight className="w-2.5 h-2.5" />
                    </div>
                  </div>

                  {/* Today's Classes List on Phone */}
                  <div className="space-y-1 text-[10px]">
                    <div className="flex items-center justify-between bg-slate-900/70 p-1.5 rounded-lg border border-slate-800">
                      <span className="truncate max-w-[125px] font-medium text-slate-200">Mathematics - III</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        Present
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-900/70 p-1.5 rounded-lg border border-slate-800">
                      <span className="truncate max-w-[125px] font-medium text-slate-200">Data Structures</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
                        Upcoming
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-900/70 p-1.5 rounded-lg border border-slate-800">
                      <span className="truncate max-w-[125px] font-medium text-slate-200">Computer Org.</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                        Theory
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Layer 4: Floating Card 1 — "Your Attendance" (Top Left, Depth: -1.6x) */}
              <div
                className="absolute -top-4 left-0 sm:-left-6 z-20 transition-transform duration-300 ease-out pointer-events-none sm:pointer-events-auto"
                style={{
                  transform:
                    isHovered && !prefersReducedMotion
                      ? `translate3d(${mousePos.x * -30}px, ${mousePos.y * -30}px, 50px) rotateX(${-mousePos.y * 6}deg) rotateY(${mousePos.x * 6}deg)`
                      : "translate3d(0, 0, 0)",
                  transformStyle: "preserve-3d",
                }}
              >
                <div className="bg-white/95 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl shadow-xl shadow-slate-900/10 border border-white/90 w-[180px] sm:w-[200px]">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-2">
                    <span>Your Attendance</span>
                    <Activity className="w-3.5 h-3.5 text-blue-600" />
                  </div>

                  <div className="flex items-center justify-between">
                    {/* Mini Bar Chart */}
                    <div className="flex items-end gap-1.5 h-9">
                      <div className="w-2.5 bg-blue-300 rounded-t h-[60%]" />
                      <div className="w-2.5 bg-blue-400 rounded-t h-[80%]" />
                      <div className="w-2.5 bg-blue-600 rounded-t h-[100%]" />
                      <div className="w-2.5 bg-cyan-400 rounded-t h-[75%]" />
                      <div className="w-2.5 bg-teal-400 rounded-t h-[90%]" />
                    </div>

                    {/* Donut progress ring */}
                    <div className="relative w-11 h-11 flex items-center justify-center">
                      <svg className="w-11 h-11 -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-slate-100"
                          strokeWidth="3.5"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className="text-blue-600"
                          strokeDasharray="78, 100"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <span className="absolute text-[11px] font-black text-slate-800">78%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Layer 5: Floating Card 2 — "Today's Schedule" (Top Right, Depth: 1.8x) */}
              <div
                className="absolute -top-6 -right-2 sm:-right-6 z-20 transition-transform duration-300 ease-out pointer-events-none sm:pointer-events-auto"
                style={{
                  transform:
                    isHovered && !prefersReducedMotion
                      ? `translate3d(${mousePos.x * 36}px, ${mousePos.y * 36}px, 60px) rotateX(${-mousePos.y * 5}deg) rotateY(${mousePos.x * 5}deg)`
                      : "translate3d(0, 0, 0)",
                  transformStyle: "preserve-3d",
                }}
              >
                <div className="bg-white/95 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl shadow-xl shadow-slate-900/10 border border-white/90 w-[205px] sm:w-[230px]">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Today's Schedule</span>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700 truncate max-w-[110px]">Attendmatics - III</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Present
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700 truncate max-w-[110px]">Data Structures</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                        Upcoming
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700 truncate max-w-[110px]">Computer Org.</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        Theory
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Layer 6: Floating Card 3 — "ERP Comparison" (Mid Right, Depth: 1.4x) */}
              <div
                className="absolute top-44 -right-1 sm:-right-4 z-20 transition-transform duration-300 ease-out pointer-events-none sm:pointer-events-auto"
                style={{
                  transform:
                    isHovered && !prefersReducedMotion
                      ? `translate3d(${mousePos.x * 24}px, ${mousePos.y * 24}px, 35px) rotateX(${-mousePos.y * 4}deg) rotateY(${mousePos.x * 4}deg)`
                      : "translate3d(0, 0, 0)",
                  transformStyle: "preserve-3d",
                }}
              >
                <div className="bg-white/95 backdrop-blur-md p-3.5 rounded-2xl shadow-xl shadow-slate-900/10 border border-white/90 w-[190px] sm:w-[210px]">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-2">
                    <div className="flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 text-indigo-600" />
                      <span>ERP Comparison</span>
                    </div>
                    <ChevronRight className="w-3 h-3 text-slate-400" />
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-slate-600">AttendWise</span>
                      </div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Present
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        <span className="text-slate-600">ERP</span>
                      </div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                        Not Updated
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Layer 7: Handwritten Cursive Script Annotation */}
              <div
                className="absolute top-12 -right-4 sm:-right-12 z-20 hidden md:block text-slate-700 font-serif italic text-xs tracking-wide rotate-12 select-none pointer-events-none"
                style={{
                  transform:
                    isHovered && !prefersReducedMotion
                      ? `translate3d(${mousePos.x * 16}px, ${mousePos.y * 16}px, 20px) rotate(12deg)`
                      : "rotate(12deg)",
                }}
              >
                <div className="font-semibold text-slate-700">
                  Real students.
                  <br />
                  Real records.
                  <br />
                  <span className="text-blue-600 font-bold">Real control. ✦</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. LOWER SECTION (Features + ERP Reality Check) */}
      <section className="px-4 sm:px-6 lg:px-8 py-8 border-t border-slate-200/80 bg-white/60">
        <div className="max-w-[1340px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left: FEATURES Header + 3 White Feature Cards (7 columns) */}
          <div id="features" className="lg:col-span-7 flex flex-col justify-between">
            <div className="mb-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 inline-block mb-1">
                FEATURES
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                Everything you need for better attendance.
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Built for students. Designed for real college life.
              </p>
            </div>

            {/* 3 Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Card 1: Track Every Class */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 border border-emerald-100">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">Track Every Class</h3>
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                    Record attendance within scheduled class windows and maintain your own class history.
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-end">
                  <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>

              {/* Card 2: Compare ERP Records */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 border border-blue-100">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">Compare ERP Records</h3>
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                    Identify differences between your personal attendance log and the college ERP.
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-end">
                  <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>

              {/* Card 3: Explain Exceptions */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3 border border-purple-100">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">Explain Exceptions</h3>
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                    Keep a dated explanation when a class is frozen or excluded from attendance calculations.
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-end">
                  <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: THE ERP REALITY CHECK Card with Real SISTec Campus Photo Background (5 columns) */}
          <div
            id="erp-reality"
            className="lg:col-span-5 relative rounded-3xl overflow-hidden shadow-xl border border-slate-800 min-h-[220px] flex items-center p-6 text-white"
          >
            {/* Real Campus Photograph Background */}
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url('/assets/sistec-campus.png')`,
                backgroundPosition: "center 38%",
              }}
            />

            {/* Dark Navy Gradient Overlay for Crisp Text Contrast */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#0B1328]/95 via-[#0E1936]/85 to-[#0B1328]/45" />

            {/* Content Overlaid onto Real Campus Photograph */}
            <div className="relative z-10 max-w-md">
              <span className="text-[10px] font-bold tracking-widest uppercase text-sky-400 bg-sky-950/70 px-2.5 py-0.5 rounded border border-sky-800/80 inline-block mb-2">
                THE ERP REALITY CHECK
              </span>

              <h3 className="text-lg sm:text-xl font-extrabold text-white leading-tight">
                Sometimes the attendance is{" "}
                <span className="text-emerald-400 underline decoration-emerald-500/40 decoration-1 underline-offset-2">
                  present.
                </span>{" "}
                Sometimes the update is{" "}
                <span className="text-violet-300 underline decoration-violet-400/40 decoration-1 underline-offset-2">
                  absent.
                </span>
              </h3>

              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                AttendWise helps students maintain a personal attendance record and compare it with college ERP entries, making discrepancies easier to identify and discuss.
              </p>

              <div className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0B1328]/90 border border-slate-700/80 text-[11px] font-medium text-emerald-400 shadow-inner">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Your data. Your control.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. FOOTER */}
      <footer className="bg-white border-t border-slate-200 px-4 sm:px-6 lg:px-8 py-5">
        <div className="max-w-[1340px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2 font-medium text-slate-700">
            <div className="w-5 h-5 rounded bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
              AW
            </div>
            <span>AttendWise · Built for SISTec Bhopal Students</span>
          </div>

          <div className="text-[11px] text-slate-400">
            © {new Date().getFullYear()} AttendWise. Personal student tracking companion.
          </div>
        </div>
      </footer>

      {/* Forgot Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter your college email address to receive a secure password reset link.
            </DialogDescription>
          </DialogHeader>

          {resetMsg && (
            <Alert className="py-2 text-xs bg-blue-50 border-blue-200 text-blue-800">
              <AlertDescription>{resetMsg}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handlePasswordReset} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="reset-email-input" className="text-xs font-medium">College Email</Label>
              <Input
                id="reset-email-input"
                type="email"
                placeholder="student@sistec.ac.in"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setResetOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                Send Reset Link
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
