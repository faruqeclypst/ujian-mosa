import { ReactNode } from "react";
import { motion } from "framer-motion";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

interface StatCardProps {
  title: string;
  description: string;
  value: ReactNode;
  icon: ReactNode;
  gradient?: string;
}

const StatCard = ({ title, description, value, icon, gradient = "from-blue-500/10 to-purple-500/10" }: StatCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className="group cursor-pointer h-full"
    >
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl shadow-lg hover:shadow-2xl active:shadow-lg transition-all duration-300 h-full flex flex-col">
        {/* Background gradient overlay */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-50 group-hover:opacity-70 transition-opacity duration-300`} />

        {/* Animated background elements - responsive sizing */}
        <div className="absolute top-0 right-0 w-20 h-20 sm:w-32 sm:h-32 bg-gradient-to-bl from-white/20 to-transparent rounded-full -translate-y-10 translate-x-10 sm:-translate-y-16 sm:translate-x-16 group-hover:scale-110 transition-transform duration-500" />
        <div className="absolute bottom-0 left-0 w-16 h-16 sm:w-24 sm:h-24 bg-gradient-to-tr from-white/10 to-transparent rounded-full translate-y-8 -translate-x-8 sm:translate-y-12 sm:-translate-x-12 group-hover:scale-110 transition-transform duration-500" />

        <CardHeader className="relative flex flex-row items-start justify-between space-y-0 pb-2 sm:pb-3 px-3 sm:px-4 lg:px-6 pt-4 sm:pt-5 lg:pt-6 flex-shrink-0">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-xs sm:text-sm font-semibold text-muted-foreground/80 group-hover:text-muted-foreground transition-colors duration-300 leading-tight">
              {title}
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed opacity-80 hidden sm:block">
              {description}
            </CardDescription>
          </div>
          <div className="relative ml-2 sm:ml-3 flex-shrink-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-white/60 to-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg group-hover:shadow-xl active:shadow-md transition-all duration-300 border border-white/20">
              <div className="text-primary group-hover:scale-110 group-active:scale-95 transition-transform duration-300">
                {icon}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative px-3 sm:px-4 lg:px-6 pb-4 sm:pb-5 lg:pb-6 flex-1 flex flex-col justify-between">
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent group-hover:from-primary group-hover:to-primary/80 transition-all duration-300 leading-tight">
            {value}
          </div>
          {/* Mobile description */}
          <CardDescription className="text-xs leading-relaxed opacity-80 sm:hidden mt-1">
            {description}
          </CardDescription>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default StatCard;
