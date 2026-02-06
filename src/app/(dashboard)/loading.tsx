export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div
        className="animate-spin h-8 w-8 border-2 border-current border-t-transparent rounded-full"
        style={{ color: 'var(--color-primary)' }}
      />
    </div>
  );
}
