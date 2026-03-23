import React from "react";

const Logo = () => {
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <div className="relative flex-shrink-0">
        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg flex items-center justify-center">
          <img
            src="/logo.png"
            alt="Logo"
            className="h-6 w-6 sm:h-8 sm:w-8 object-contain"
          />
        </div>
        <div className="absolute -bottom-1 -right-1 h-3 w-3 sm:h-4 sm:w-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 shadow-sm"></div>
      </div>
      <div className="flex flex-col justify-center min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-base sm:text-lg font-bold text-foreground leading-none">Piket</h1>
          <div className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium rounded shrink-0">
            v2.0
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-tight mt-0.5 sm:mt-1 font-medium truncate">
          SMAN MODAL BANGSA
        </p>
      </div>
    </div>
  );
};

export default Logo;
