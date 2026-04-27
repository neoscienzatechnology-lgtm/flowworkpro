interface LoadingSpinnerProps {
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function LoadingSpinner({ fullScreen = true, size = 'md' }: LoadingSpinnerProps) {
  const sizeClass = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' }[size];

  const spinner = (
    <div className={`${sizeClass} border-2 border-blue-600 border-t-transparent rounded-full animate-spin`} />
  );

  if (!fullScreen) return spinner;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
      <div className="flex flex-col items-center gap-4">
        {spinner}
        <p className="text-gray-500 text-sm">Carregando...</p>
      </div>
    </div>
  );
}
