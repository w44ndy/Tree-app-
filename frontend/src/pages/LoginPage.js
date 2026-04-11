import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Loader2, TreePine } from 'lucide-react';

const WC_LOGO = "https://customer-assets.emergentagent.com/job_tree-logistics/artifacts/7lohxwsd_2025Logo.png";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      {/* Left - Image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src="https://static.prod-images.emergentagent.com/jobs/1bf62ab5-4add-4c71-a4bb-fc46b76e2d54/images/c8fe9b9ccc13c9cb8e3c4f3ce84aab0415dca2c98b20a7390d959b78cf0d84ca.png"
          alt="Christmas Tree Yard"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1A4331]/80 to-[#1A4331]/40" />
        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <img src={WC_LOGO} alt="Wilson Contractors" className="h-16 object-contain mb-4 drop-shadow-lg" />
          <h1 className="text-4xl font-bold tracking-tight font-['Outfit']">Tree Management System</h1>
          <p className="mt-2 text-sm opacity-70">Mains of Corsindae, Aberdeenshire</p>
        </div>
      </div>

      {/* Right - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#F4F1ED]">
        <div className="w-full max-w-md">
          {/* Logo for mobile/tablet - hidden on desktop where left panel shows */}
          <div className="lg:hidden flex justify-center mb-8">
            <img src={WC_LOGO} alt="Wilson Contractors" className="h-14 object-contain" />
          </div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-[#1A4331] flex items-center justify-center">
              <TreePine className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#0A1711] font-['Outfit']">Sign In</h2>
              <p className="text-sm text-[#4A5D53]">TMS.wilson-contractors.co.uk</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm" data-testid="login-error">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#0A1711] font-medium">Email or Username</Label>
              <Input
                id="email"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email or username"
                className="h-11 bg-white border-[#1A4331]/15 focus:ring-[#1A4331]/50"
                data-testid="login-email-input"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#0A1711] font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="h-11 bg-white border-[#1A4331]/15 focus:ring-[#1A4331]/50"
                data-testid="login-password-input"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#1A4331] text-white hover:bg-[#1A4331]/90 rounded-lg font-medium"
              data-testid="login-submit-button"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
