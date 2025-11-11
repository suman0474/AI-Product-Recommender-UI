import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Brain, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const Signup = () => {
  // State for form inputs
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // New state to track if the account is pending admin approval
  const [isPending, setIsPending] = useState(false);

  const { signup, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic form validation
    if (!email.trim() || !username.trim() || !password.trim() || password !== confirmPassword) {
      return;
    }

    try {
      // Call the signup function from the AuthContext
      await signup({
        email: email.trim(),
        username: username.trim(),
        password,
      });
      // If the signup is successful, set the pending state to true
      // The user will remain on this page with a confirmation message
      setIsPending(true);
    } catch (error) {
      // Errors are handled by the toast in AuthContext, so we just log and reset the state if needed.
      console.error("Signup failed:", error);
      setIsPending(false);
    }
  };

  const isFormValid =
    email.trim() &&
    username.trim() &&
    password.trim() &&
    confirmPassword.trim() &&
    password === confirmPassword;

  // Render a success message if the account is pending approval
  if (isPending) {
    return (
      <div className="min-h-screen app-gradient flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="surface-card p-8 text-center rounded-2xl">
            <div className="w-20 h-20 mx-auto mb-6">
              <img src="/ChatGPT Image Nov 11, 2025, 11_58_30 AM.png" alt="Logo" className="w-full h-full rounded-full object-cover" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Account Created!</h2>
            <p className="text-muted-foreground mb-6">
              Your account has been created and is awaiting admin approval. You will receive an email once your account is active.
            </p>
            <button onClick={() => navigate('/login')} className="btn-primary w-full px-4 py-3 rounded-lg">Go to Login</button>
          </div>
        </div>
      </div>
    );
  }

  // Render the signup form if the account is not pending
  return (
    <div className="min-h-screen app-gradient flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6 text-muted-foreground hover:text-foreground transition-colors duration-200 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Button>

        <div className="surface-card p-8 rounded-2xl">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 mx-auto">
              <img src="/ChatGPT Image Nov 11, 2025, 11_58_30 AM.png" alt="Logo" className="w-full h-full rounded-full object-cover shadow" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">
                Create Account
              </h1>
              <p className="text-muted-foreground mt-2 text-base">
                Join Controls Systems Recommender today
              </p>
            </div>
          </div>

          <div>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input rounded-xl"
                  required
                />
              </div>

              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username" className="font-medium">
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="form-input rounded-xl"
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input pr-12 rounded-xl"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="font-medium">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="form-input pr-12 rounded-xl"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {password && confirmPassword && password !== confirmPassword && (
                  <p className="text-sm text-red-600 mt-1">Passwords do not match</p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn-primary w-full font-semibold rounded-xl px-4 py-3"
                disabled={isLoading || !isFormValid}
              >
                {isLoading ? (
                  <span className="animate-pulse">Creating Account...</span>
                ) : (
                  'Create Account'
                )}
              </button>

              {/* Login Redirect */}
              <div className="text-center pt-4">
                <p className="text-muted-foreground text-sm">
                  Already have an account?{' '}
                  <Link
                    to="/login"
                    className="font-semibold"
                  >
                    <span className="text-blue-600">Sign in</span>
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
