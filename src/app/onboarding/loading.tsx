export default function OnboardingLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen" role="status" aria-busy="true">
      <div className="animate-spin h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
