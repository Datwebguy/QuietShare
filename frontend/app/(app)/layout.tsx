export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto min-h-screen max-w-md px-4 pb-12 pt-6 sm:max-w-lg">{children}</div>;
}
