
import { Hammer, Cog, Sparkles } from 'lucide-react';

export function Maintenance() {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-gray-950 text-white relative overflow-hidden font-sans">
      
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="absolute top-[60%] -right-[10%] w-[50%] h-[50%] rounded-full bg-purple-600/20 blur-[120px]" />
      </div>

      <div className="z-10 flex flex-col items-center justify-center p-6 max-w-md text-center space-y-8">
        
        {/* Icon Animation Container */}
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full animate-pulse" />
          <div className="relative w-24 h-24 bg-gray-900 border border-gray-700/50 rounded-2xl shadow-2xl flex items-center justify-center overflow-hidden">
            <Cog className="w-12 h-12 text-blue-400 absolute opacity-30 animate-[spin_4s_linear_infinite] scale-150" />
            <Hammer className="w-10 h-10 text-white relative z-10 animate-[bounce_2s_ease-in-out_infinite]" />
          </div>
          <Sparkles className="w-6 h-6 text-yellow-400 absolute -top-2 -right-2 animate-pulse" />
        </div>

        {/* Text Content */}
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-linear-to-r from-white to-gray-400">
            Estamos em Manutenção
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-sm mx-auto leading-relaxed">
            Estamos preparando novidades incríveis para você. Nosso sistema está passando por melhorias e voltará em breve.
          </p>
        </div>

        {/* Divider / Loader */}
        <div className="w-full flex items-center justify-center gap-2">
          <div className="h-1 w-2 rounded-full bg-blue-500 animate-[pulse_1s_ease-in-out_infinite]" />
          <div className="h-1 w-2 rounded-full bg-blue-500 animate-[pulse_1s_ease-in-out_infinite_200ms]" />
          <div className="h-1 w-2 rounded-full bg-blue-500 animate-[pulse_1s_ease-in-out_infinite_400ms]" />
        </div>
      </div>
    </div>
  );
}
