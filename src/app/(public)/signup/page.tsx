'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    // Step 1: Plan selection
    planId: 'agent-only',
    billingCycle: 'monthly' as 'monthly' | 'yearly',
    
    // Step 2: Account info
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    
    // Step 3: Payment (if not trial)
    startTrial: true,
  });

  const plans = {
    'agent-only': {
      name: 'Agent Only',
      monthlyPrice: 29,
      yearlyPrice: 280,
    },
    'starter': {
      name: 'Starter',
      monthlyPrice: 49,
      yearlyPrice: 470,
    },
    'professional': {
      name: 'Professional',
      monthlyPrice: 149,
      yearlyPrice: 1430,
    },
  };

  const selectedPlan = plans[formData.planId as keyof typeof plans];
  const price = formData.billingCycle === 'monthly' 
    ? selectedPlan.monthlyPrice 
    : selectedPlan.yearlyPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (step === 1) {
      setStep(2);
      return;
    }
    
    if (step === 2) {
      // Validate password
      if (formData.password !== formData.confirmPassword) {
        alert('Passwords do not match');
        return;
      }
      
      if (formData.password.length < 8) {
        alert('Password must be at least 8 characters');
        return;
      }
      
      if (formData.startTrial) {
        // Create account with trial
        await createAccount();
      } else {
        setStep(3);
      }
      return;
    }
    
    if (step === 3) {
      // Process payment then create account
      await processPayment();
    }
  };

  const createAccount = async () => {
    try {
      // TODO: Implement account creation
      console.log('Creating account:', formData);
      
      // For now, just redirect to login
      alert('Account created! Please check your email to verify your account.');
      router.push('/login');
    } catch (error) {
      console.error('Failed to create account:', error);
      alert('Failed to create account');
    }
  };

  const processPayment = async () => {
    try {
      // TODO: Implement Stripe payment
      console.log('Processing payment:', formData);
      
      await createAccount();
    } catch (error) {
      console.error('Failed to process payment:', error);
      alert('Failed to process payment');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-4">
            {[
              { num: 1, label: 'Choose Plan' },
              { num: 2, label: 'Create Account' },
              { num: 3, label: 'Payment' },
            ].map((s) => (
              <div key={s.num} className="flex items-center gap-2">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    step >= s.num
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {s.num}
                </div>
                <span className={step >= s.num ? 'text-white' : 'text-gray-400'}>
                  {s.label}
                </span>
                {s.num < 3 && <div className="w-12 h-0.5 bg-gray-700" />}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
          <form onSubmit={handleSubmit}>
            {/* Step 1: Plan Selection */}
            {step === 1 && (
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">Choose Your Plan</h1>
                <p className="text-gray-400 mb-8">Start with a 14-day free trial</p>

                {/* Billing Cycle */}
                <div className="flex items-center justify-center gap-4 mb-8">
                  <span className={formData.billingCycle === 'monthly' ? 'text-white font-semibold' : 'text-gray-400'}>
                    Monthly
                  </span>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, billingCycle: formData.billingCycle === 'monthly' ? 'yearly' : 'monthly' })}
                    className="relative w-16 h-8 bg-purple-600 rounded-full"
                  >
                    <div className={`absolute top-1 ${formData.billingCycle === 'yearly' ? 'left-9' : 'left-1'} w-6 h-6 bg-white rounded-full transition-all`} />
                  </button>
                  <span className={formData.billingCycle === 'yearly' ? 'text-white font-semibold' : 'text-gray-400'}>
                    Yearly <span className="text-green-400 text-sm">(Save 20%)</span>
                  </span>
                </div>

                {/* Plan Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  {Object.entries(plans).map(([id, plan]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFormData({ ...formData, planId: id })}
                      className={`p-6 rounded-xl border-2 transition text-left ${
                        formData.planId === id
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                      <div className="text-3xl font-bold text-white mb-2">
                        ${formData.billingCycle === 'monthly' ? plan.monthlyPrice : Math.round(plan.yearlyPrice / 12)}
                        <span className="text-sm text-gray-400">/mo</span>
                      </div>
                      {formData.billingCycle === 'yearly' && (
                        <div className="text-sm text-gray-400">
                          ${plan.yearlyPrice} billed annually
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition text-lg"
                >
                  Continue →
                </button>
              </div>
            )}

            {/* Step 2: Account Creation */}
            {step === 2 && (
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">Create Your Account</h1>
                <p className="text-gray-400 mb-8">
                  {selectedPlan.name} - ${price}/{formData.billingCycle === 'monthly' ? 'month' : 'year'}
                </p>

                <div className="space-y-4 mb-8">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Company Name</label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      placeholder="Acme Inc."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      placeholder="you@company.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Password</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      placeholder="••••••••"
                      required
                      minLength={8}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Confirm Password</label>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      placeholder="••••••••"
                      required
                      minLength={8}
                    />
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.startTrial}
                      onChange={(e) => setFormData({ ...formData, startTrial: e.target.checked })}
                      className="w-5 h-5"
                    />
                    <span className="text-gray-300">
                      Start with 14-day free trial (no credit card required)
                    </span>
                  </label>
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 py-4 bg-gray-700 text-white rounded-lg font-bold hover:bg-gray-600 transition"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-4 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition"
                  >
                    {formData.startTrial ? 'Start Free Trial' : 'Continue to Payment →'}
                  </button>
                </div>

                <p className="text-center text-sm text-gray-400 mt-6">
                  Already have an account?{' '}
                  <Link href="/login" className="text-purple-400 hover:text-purple-300">
                    Sign in
                  </Link>
                </p>
              </div>
            )}

            {/* Step 3: Payment */}
            {step === 3 && (
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">Payment Information</h1>
                <p className="text-gray-400 mb-8">
                  ${price}/{formData.billingCycle === 'monthly' ? 'month' : 'year'} after trial
                </p>

                <div className="p-6 bg-gray-700 rounded-lg mb-8">
                  <div className="text-center text-gray-300">
                    Stripe payment form will go here
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex-1 py-4 bg-gray-700 text-white rounded-lg font-bold hover:bg-gray-600 transition"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-4 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition"
                  >
                    Complete Signup →
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          By signing up, you agree to our{' '}
          <Link href="/terms" className="text-purple-400 hover:text-purple-300">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-purple-400 hover:text-purple-300">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}

