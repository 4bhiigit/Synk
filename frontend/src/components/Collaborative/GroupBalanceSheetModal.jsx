import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';
import Avatar from '../Common/Avatar';
import Loader from '../Common/Loader';
import { Receipt, X, DollarSign, ArrowUpRight, ArrowDownLeft, CheckCircle2, TrendingUp } from 'lucide-react';

export const GroupBalanceSheetModal = ({ isOpen, onClose, roomId }) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !roomId) return;

    const fetchSummary = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/chat/rooms/${roomId}/expenses/summary/`);
        setSummary(res.data);
      } catch (err) {
        console.error('Failed to load expense summary:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [isOpen, roomId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl rounded-2xl glass-panel shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 bg-zinc-950 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white text-black font-bold shadow-md">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Group Balance Sheet</h3>
              <p className="text-xs text-zinc-400">Expense breakdown & settlement summary</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <Loader text="Calculating group balances..." className="py-12" />
          ) : !summary || summary.total_expenses_count === 0 ? (
            <div className="p-12 text-center text-zinc-400">
              <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-semibold text-zinc-300">No expenses recorded yet</p>
              <p className="text-xs text-zinc-500 mt-1">
                Use the slash command <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-white">/split 600 Dinner</code> in chat to split bills!
              </p>
            </div>
          ) : (
            <>
              {/* Summary Metric Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total Pool Spent</span>
                  <div className="text-2xl font-extrabold text-white mt-1">
                    ${summary.total_spent.toFixed(2)}
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">{summary.total_expenses_count} bills split</span>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Unsettled Debt</span>
                  <div className="text-2xl font-extrabold text-amber-400 mt-1">
                    ${summary.total_unsettled.toFixed(2)}
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">Pending payment</span>
                </div>
              </div>

              {/* Member Net Balances */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5">
                  Member Net Balances
                </h4>
                <div className="space-y-2">
                  {summary.member_balances?.map((m) => {
                    const isPositive = m.net_balance > 0;
                    const isZero = Math.abs(m.net_balance) < 0.01;

                    return (
                      <div
                        key={m.user?.id}
                        className="p-3 rounded-xl bg-zinc-900/50 border border-white/5 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={m.user?.avatar_url}
                            name={m.user?.first_name || m.user?.username}
                            size="sm"
                          />
                          <div>
                            <p className="font-semibold text-white">
                              {m.user?.first_name ? `${m.user.first_name} ${m.user.last_name}` : m.user?.username}
                            </p>
                            <p className="text-[11px] text-zinc-400">Paid: ${m.paid_total.toFixed(2)} | Share: ${m.owed_total.toFixed(2)}</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`font-bold text-sm ${
                              isZero
                                ? 'text-zinc-400'
                                : isPositive
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {isPositive ? `+$${m.net_balance.toFixed(2)}` : isZero ? '$0.00' : `-$${Math.abs(m.net_balance).toFixed(2)}`}
                          </span>
                          <p className="text-[10px] text-zinc-500">
                            {isPositive ? 'Gets back' : isZero ? 'All settled' : 'Owes'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupBalanceSheetModal;
