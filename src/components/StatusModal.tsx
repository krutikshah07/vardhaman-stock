import React from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type StatusType = 'success' | 'error';

interface StatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: StatusType;
  title: string;
  message: string;
}

export const StatusModal: React.FC<StatusModalProps> = ({ isOpen, onClose, type, title, message }) => {
  React.useEffect(() => {
    if (isOpen && type === 'success') {
      const timer = setTimeout(onClose, 800);
      return () => clearTimeout(timer);
    }
  }, [isOpen, type, onClose]);

  const isStockUpdate = title.toLowerCase().includes('stock') || message.toLowerCase().includes('quantity') || title.toLowerCase().includes('packing') || message.toLowerCase().includes('packing');

  return (
    <AnimatePresence>
      {isOpen && (
        <div className={`fixed z-[250] flex p-4 pointer-events-none ${
          isStockUpdate 
            ? 'top-4 right-4 items-start justify-end' 
            : 'inset-0 items-center justify-center'
        }`}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: isStockUpdate ? -10 : 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: isStockUpdate ? -10 : 20 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={`pointer-events-auto relative rounded-2xl shadow-2xl border flex items-center text-left ${
              isStockUpdate 
                ? 'w-auto max-w-sm px-4 py-3 bg-emerald-600 border-emerald-500 text-white gap-3' 
                : `w-full max-w-xs p-6 flex-col items-center text-center ${
                    type === 'success' 
                      ? 'bg-emerald-600 border-emerald-500 text-white' 
                      : 'bg-red-600 border-red-500 text-white'
                  }`
            }`}
          >
            {isStockUpdate ? (
              <>
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/20 shrink-0">
                  <CheckCircle2 size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider">{title}</h3>
                  <p className="text-[10px] font-bold opacity-90 uppercase truncate max-w-[200px]">{message}</p>
                </div>
              </>
            ) : (
              <>
                <div className={`mb-4 w-16 h-16 rounded-full flex items-center justify-center bg-white/20 ring-8 ${
                  type === 'success' ? 'ring-emerald-500/30' : 'ring-red-500/30'
                }`}>
                  {type === 'success' ? (
                    <CheckCircle2 size={32} className="text-white" />
                  ) : (
                    <AlertCircle size={32} className="text-white" />
                  )}
                </div>

                <h3 className="text-xl font-black uppercase tracking-tighter mb-1">{title}</h3>
                <p className="text-sm font-bold opacity-90 uppercase">{message}</p>

                {type === 'error' && (
                  <button
                    onClick={onClose}
                    className="mt-6 w-full py-2 bg-white text-red-600 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-red-50 transition-colors"
                  >
                    Close
                  </button>
                )}
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
