import React from 'react';
import { motion } from 'motion/react';

export const LoadingScreen = () => {
  return (
    <div className="flex flex-col h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <div className="relative flex items-center justify-center">
        {/* Outer rotating ring */}
        <motion.div
          className="absolute w-24 h-24 border-4 border-blue-500/20 border-t-blue-600 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        
        {/* Logo with pulsing effect */}
        <motion.div
          className="relative z-10"
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <img 
            src="https://hdd.io.vn/img/bmassloadings.png" 
            alt="Logo" 
            className="w-20 h-20 object-contain"
            referrerPolicy="no-referrer"
          />
        </motion.div>
      </div>
      
      <motion.div
        className="mt-8 flex flex-col items-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Quỹ TYT VTĐ
        </h2>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 bg-blue-600 rounded-full"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
};
