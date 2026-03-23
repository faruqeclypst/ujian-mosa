import { motion } from "framer-motion";

const LoadingScreen = () => {
  return (
    <div className="flex h-full min-h-[60vh] w-full flex-col items-center justify-center gap-4 text-muted-foreground">
      <motion.div
        className="h-16 w-16 rounded-full border-4 border-primary/30 border-t-primary"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
      />
      <p className="text-sm font-medium">Memuat dashboard...</p>
    </div>
  );
};

export default LoadingScreen;
