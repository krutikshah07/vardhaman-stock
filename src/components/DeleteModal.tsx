import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName: string;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({ isOpen, onClose, onConfirm, itemName }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-red-600">
                  <AlertCircle size={24} />
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Item?</h3>
              <p className="text-slate-500 leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-slate-900 uppercase">"{itemName}"</span>? This action cannot be undone and will remove the item from all office records.
              </p>
            </div>

            <div className="bg-slate-50 p-6 flex flex-col md:flex-row gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
