'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { serverTimestamp } from 'firebase/firestore';
import { auth } from '@/lib/firebase/config'
import { dal } from '@/lib/firebase/dal';
import { logger } from '@/lib/logger/logger';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

interface FirebaseError {
  code: string;
  message: string;
}

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    // Step 1: Plan selection
    planId: 'tier1',
    billingCycle: 'monthly' as 'monthly' | 'yearly',
    
    // Step 2: Account info
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    
    // Step 3: Payment (if not trial)
    startTrial: true,
  });

  // NEW: Volume-based tiers
  const tiers = {
    'tier1': {
      name: 'Tier 1',
      monthlyPrice: 400,
      yearlyPrice: 4000,
      recordCapacity: '0-100 records',
    },
    'tier2': {
      name: 'Tier 2',
      monthlyPrice: 650,
      yearlyPrice: 6500,
      recordCapacity: '101-250 records',
    },
    'tier3': {
      name: 'Tier 3',
      monthlyPrice: 1000,
      yearlyPrice: 10000,
      recordCapacity: '251-500 records',
    },
    'tier4': {
      name: 'Tier 4',
      monthlyPrice: 1250,
      yearlyPrice: 12500,
      recordCapacity: '501-1,000 records',
    },
  };

  const selectedPlan = tiers[formData.planId as keyof typeof tiers];
  const price = formData.billingCycle === 'monthly' 
    ? selectedPlan.monthlyPrice 
    : selectedPlan.yearlyPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    logger.info('Form submitted!', { step, file: 'page.tsx' });
    
    if (step === 1) {
      logger.info('Moving to step 2', { file: 'page.tsx' });
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

  // NEW: Create account with mandatory payment method
  const createAccount = async (paymentMethodId?: string) => {
    try {
      logger.info('Creating account with payment method', { 
        email: formData.email, 
        tier: formData.planId,
        hasPaymentMethod: !!paymentMethodId,
        file: 'page.tsx' 
      });
      
      if (!auth) {
        throw new Error('Firebase not initialized');
      }

      // NEW: For trial, payment method is REQUIRED
      if (formData.startTrial && !paymentMethodId) {
        throw new Error('Payment method required for trial. Credit card must be on file.');
      }

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      
      const user = userCredential.user;
      logger.info('User created in Auth', { uid: user.uid, file: 'page.tsx' });

      // Generate organization ID
      const orgId = `org_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // NEW: Create Stripe customer and subscription
      const subscriptionResponse = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          email: formData.email,
          name: formData.companyName,
          tierId: formData.planId || 'tier1', // Default to tier1
          paymentMethodId, // Attach payment method to subscription
          trialDays: formData.startTrial ? 14 : 0,
        }),
      });

      if (!subscriptionResponse.ok) {
        throw new Error('Failed to create subscription');
      }

      const { customerId, subscriptionId } = await subscriptionResponse.json();

      // Create organization document in Firestore using DAL
      await dal.safeSetDoc('ORGANIZATIONS', orgId, {
        name: formData.companyName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ownerId: user.uid,
        tier: formData.planId || 'tier1', // NEW: Tier-based
        plan: formData.planId, // DEPRECATED: Kept for backward compat
        billingCycle: formData.billingCycle,
        trialEndsAt: formData.startTrial 
          ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() 
          : null,
        status: formData.startTrial ? 'trialing' : 'active',
        stripeCustomerId: customerId,
        subscriptionId: subscriptionId,
      }, {
        audit: true,
        userId: user.uid,
        organizationId: orgId,
      });
      logger.info('Organization created with subscription', { orgId, subscriptionId, file: 'page.tsx' });

      // Create user document in Firestore using DAL
      await dal.safeSetDoc('USERS', user.uid, {
        email: formData.email,
        organizationId: orgId,
        role: 'owner',
        name: formData.companyName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, {
        audit: true,
        userId: user.uid,
        organizationId: orgId,
      });
      logger.info('User document created', { file: 'page.tsx' });

      // Success!
      alert(`Account created successfully! Welcome to ${formData.companyName}!\n\n${formData.startTrial ? '14-day free trial started. You\'ll be charged based on your usage at the end of the trial.' : 'Subscription activated!'}`);
      
      // Redirect to onboarding
      router.push(`/workspace/${orgId}/onboarding`);
    } catch (err) {
      const error = err as FirebaseError;
      logger.error('Failed to create account:', error, { file: 'page.tsx' });
      
      // User-friendly error messages
      let errorMessage = 'Failed to create account';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Try logging in instead.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use a stronger password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    }
  };

  const processPayment = async () => {
    try {
      // TODO: Implement Stripe payment
      logger.info('Processing payment', { plan: formData.planId, billingCycle: formData.billingCycle, file: 'page.tsx' });
      
      await createAccount();
    } catch (error) {
      logger.error('Failed to process payment:', error, { file: 'page.tsx' });
      alert('Failed to process payment');
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
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
                      ? 'bg-gray-800 text-white'
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
                    className="relative w-16 h-8 bg-gray-700 rounded-full"
                  >
                    <div className={`absolute top-1 ${formData.billingCycle === 'yearly' ? 'left-9' : 'left-1'} w-6 h-6 bg-white rounded-full transition-all`} />
                  </button>
                  <span className={formData.billingCycle === 'yearly' ? 'text-white font-semibold' : 'text-gray-400'}>
                    Yearly <span className="text-green-400 text-sm">(Save 20%)</span>
                  </span>
                </div>

                {/* Plan Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  {Object.entries(tiers).map(([id, plan]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFormData({ ...formData, planId: id })}
                      className={`p-6 rounded-xl border-2 transition text-left ${
                        formData.planId === id
                          ? 'border-gray-600 bg-gray-800'
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
                  className="w-full py-4 bg-gray-800 text-white rounded-lg font-bold hover:bg-gray-700 transition text-lg"
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

                  {/* Credit card is now required - trial checkbox removed */}
                  <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <p className="text-gray-300 text-sm">
                      💳 Credit card required to start your 14-day free trial. You won't be charged until your trial ends.
                    </p>
                  </div>
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
                    className="flex-1 py-4 bg-gray-800 text-white rounded-lg font-bold hover:bg-gray-700 transition"
                  >
                    {formData.startTrial ? 'Start Free Trial' : 'Continue to Payment →'}
                  </button>
                </div>

                <p className="text-center text-sm text-gray-400 mt-6">
                  Already have an account?{' '}
                  <Link href="/login" className="text-gray-400 hover:text-gray-300">
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
                    className="flex-1 py-4 bg-gray-800 text-white rounded-lg font-bold hover:bg-gray-700 transition"
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
          <Link href="/terms" className="text-gray-400 hover:text-gray-300">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-gray-400 hover:text-gray-300">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}





