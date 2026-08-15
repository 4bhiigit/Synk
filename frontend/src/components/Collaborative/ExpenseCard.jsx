import React, { useState } from 'react';
import api from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../Common/Avatar';
import { Receipt, CheckCircle, Clock, Check, Loader2, Sparkles } from 'lucide-react';

export const ExpenseCard = ({ message, onExpenseUpdated }) => {
  const { user } = useAuth();
  const [settlingId, setSettlingId] = useState(null);
  const expense = message.expense_data;

  if (!expense) {
    return (
      <div className="p-3 rounded-xl bg-zinc-900 border border-white/10 text-xs text-zinc-300">
        <Receipt className="w-4 h-4 inline-block mr-1 text-zinc-400" />
        <span>{message.content}</span>
      </div>
    );
  }

  const splits = expense.splits || [];
  const currentSplit = splits.find((s) => s.user?.id === user?.id);
  const settledCount = splits.filter((s) => s.is_settled).length;
  const totalCount = splits.length || 1;
  const progressPercent = Math.round((settledCount / totalCount) * 100);

  const handleToggleSettle = async (splitId) => {
    try {
      setSettlingId(splitId);
      const res = await api.patch(`/api/chat/expenses/${splitId}/settle/`);
      if (onExpenseUpdated) {
        onExpenseUpdated(res.data);
      }
    } catch (err) {
      console.error('Failed to toggle settlement:', err);
    } finally {
      setSettlingId(null);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-2xl glass-card border border-white/15 p-4 shadow-xl text-left animate-slide-up">
      {/* Card Header */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-white text-black font-bold shadow-md">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight">{expense.description}</h4>
            <p className="text-[11px] text-zinc-400">Created by {expense.created_by?.username}</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-base font-extrabold text-white">${parseFloat(expense.total_amount).toFixed(2)}</span>
          <p className="text-[10px] text-zinc-400 font-medium">Total Bill</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3.5">
        <div className="flex justify-between text-[11px] font-medium text-zinc-400 mb-1.5">
          <span>Settlement Progress</span>
          <span className="text-white font-semibold">{settledCount}/{totalCount} Paid ({progressPercent}%)</span>
        </div>
        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Split Members Breakdown */}
      <div className="space-y-2 mb-3">
        {splits.map((split) => {
          const isMe = split.user?.id === user?.id;
          const isSettled = split.is_settled;
          const isCreator = expense.created_by?.id === user?.id;

          return (
            <div
              key={split.id}
              className={`p-2 rounded-xl flex items-center justify-between text-xs transition-colors ${
                isSettled ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-zinc-900/60 border border-white/5'
              }`}
            >
              <div className="flex items-center gap-2">
                <Avatar
                  src={split.user?.avatar_url}
                  name={split.user?.username}
                  size="xs"
                />
                <div>
                  <span className="font-medium text-zinc-200">
                    {split.user?.first_name ? `${split.user.first_name}` : split.user?.username}
                    {isMe && <span className="text-zinc-400 font-normal"> (You)</span>}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">${parseFloat(split.amount_owed).toFixed(2)}</span>

                {isSettled ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Paid
                  </span>
                ) : (
                  (isMe || isCreator) && (
                    <button
                      onClick={() => handleToggleSettle(split.id)}
                      disabled={settlingId === split.id}
                      className="px-2.5 py-1 rounded-lg btn-primary text-[10px] flex items-center gap-1 font-semibold"
                    >
                      {settlingId === split.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <span>Mark Paid</span>
                      )}
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExpenseCard;
