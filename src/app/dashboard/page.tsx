export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <p className="text-xl font-medium text-text-primary">
        Select a project from the sidebar.
      </p>
      <p className="text-text-muted">
        Use &ldquo;New Project&rdquo; to create a universe, series, or story.
      </p>
    </div>
  );
}
