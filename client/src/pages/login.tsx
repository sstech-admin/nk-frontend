import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/lib/auth-context";
import { USE_REAL_API } from "@/lib/api";
import { LogIn, Loader2, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SiFacebook, SiGoogle, SiApple } from "react-icons/si";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    const result = await login(data.email, data.password);
    setLoading(false);
    if (result.success) {
      navigate("/dashboard");
    } else {
      toast({
        title: "Login failed",
        description: result.error ?? "Invalid email or password",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4"
      style={{
        background: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 25%, #e0f7fa 50%, #dbeafe 75%, #e8eaf6 100%)",
      }}
    >
      <div className="absolute inset-0 opacity-30"
        style={{
          background: "radial-gradient(ellipse at 30% 80%, rgba(255,255,255,0.8) 0%, transparent 60%), radial-gradient(ellipse at 70% 20%, rgba(255,255,255,0.6) 0%, transparent 50%)",
        }}
      />

      <div className="absolute top-6 left-6 flex items-center gap-2 z-10">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white shadow-sm border border-slate-200">
          <img
            src="/nk-logo.png"
            alt="NK Tech Craft"
            className="h-6 w-6 object-contain"
          />
        </div>
        <span className="text-lg font-bold text-slate-800">NK Tech Craft</span>
      </div>

      <Card className="relative z-10 w-full max-w-md border-0 bg-white/80 backdrop-blur-xl shadow-xl" data-testid="card-login">
        <CardContent className="p-8">
          <div className="flex justify-center mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
              <LogIn className="h-5 w-5 text-foreground" />
            </div>
          </div>

          <h1 className="text-xl font-bold text-center mb-1" data-testid="text-login-title">Sign in with email</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">Manage your orders, teams, and workflows. For free</p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="Email"
                          className="pl-10 h-11 bg-muted/50 border-muted"
                          {...field}
                          data-testid="input-email"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Password"
                          className="pl-10 pr-10 h-11 bg-muted/50 border-muted"
                          {...field}
                          data-testid="input-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end">
                <span className="text-xs text-muted-foreground cursor-pointer hover:underline">Forgot password?</span>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold"
                disabled={loading}
                data-testid="button-login"
                style={{ backgroundColor: "hsl(240 6% 10%)", color: "white" }}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Get Started
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-muted" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white/80 px-3 text-muted-foreground">Or sign in with</span>
                </div>
              </div>

              <div className="flex justify-center gap-4">
                <Button variant="outline" size="icon" type="button" className="rounded-xl h-11 w-14 bg-white/60" data-testid="button-google-login">
                  <SiGoogle className="h-4 w-4" style={{ color: "#4285F4" }} />
                </Button>
                <Button variant="outline" size="icon" type="button" className="rounded-xl h-11 w-14 bg-white/60" data-testid="button-facebook-login">
                  <SiFacebook className="h-4 w-4" style={{ color: "#1877F2" }} />
                </Button>
                <Button variant="outline" size="icon" type="button" className="rounded-xl h-11 w-14 bg-white/60" data-testid="button-apple-login">
                  <SiApple className="h-4 w-4" />
                </Button>
              </div>

              {!USE_REAL_API && (
                <p className="text-xs text-center text-muted-foreground mt-4">
                  Demo: admin@nktech.com / admin123 (Admin) · designer1@gmail.com / Test@123 (Employee)
                </p>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
