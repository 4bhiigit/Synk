import React from 'react';
import { BarChart3, CheckCircle2, Circle, Users, Lock, XCircle } from 'lucide-react';

export const PollCard = ({
  message,
  pollData,
  currentUserId,
  onVote,
  onClosePoll,
  isAdmin = false,
}) => {
  const poll = pollData || message.poll_data;
  if (!poll) return null;

  const isCreator = poll.created_by?.id === currentUserId;
  const canClose = (isCreator || isAdmin) && !poll.is_closed;
  const myVotedOptionIds = new Set(poll.my_voted_option_ids || []);

  return (
    <div className="w-full max-w-sm rounded-2xl bg-[#141418] border border-white/15 p-4 shadow-xl select-none animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-indigo-500/20 text-indigo-400">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs md:text-sm font-bold text-white leading-tight">
              {poll.question}
            </h4>
            <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
              <span>{poll.is_multiple_choice ? 'Multiple Choice' : 'Single Choice'}</span>
              <span>•</span>
              <span>{poll.is_anonymous ? 'Anonymous' : 'Public'}</span>
              {poll.is_closed && (
                <>
                  <span>•</span>
                  <span className="text-rose-400 font-bold">Closed</span>
                </>
              )}
            </div>
          </div>
        </div>

        {canClose && (
          <button
            type="button"
            onClick={() => onClosePoll && onClosePoll(poll.id)}
            className="text-[10px] text-zinc-400 hover:text-rose-400 px-2 py-1 rounded-lg bg-zinc-800 hover:bg-rose-500/10 transition-colors"
            title="Close Poll"
          >
            End Poll
          </button>
        )}
      </div>

      {/* Options List */}
      <div className="space-y-2 mb-3">
        {poll.options.map((opt) => {
          const isVoted = myVotedOptionIds.has(opt.id) || opt.is_voted_by_me;
          const percentage = opt.percentage || 0;

          return (
            <button
              key={opt.id}
              type="button"
              disabled={poll.is_closed}
              onClick={() => onVote && onVote(poll.id, opt.id)}
              className={`w-full text-left relative overflow-hidden rounded-xl p-2.5 border transition-all ${
                isVoted
                  ? 'border-indigo-500/60 bg-indigo-950/30 shadow-inner'
                  : 'border-white/10 bg-zinc-900/60 hover:bg-zinc-800/80'
              } ${poll.is_closed ? 'cursor-default opacity-80' : 'cursor-pointer active:scale-[0.99]'}`}
            >
              {/* Dynamic Percentage Fill Bar */}
              <div
                style={{ width: `${percentage}%` }}
                className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                  isVoted
                    ? 'bg-indigo-500/25'
                    : 'bg-white/10'
                }`}
              />

              <div className="relative z-10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {poll.is_multiple_choice ? (
                    isVoted ? (
                      <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                    )
                  ) : isVoted ? (
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                  )}
                  <span className={`text-xs font-semibold truncate ${isVoted ? 'text-white' : 'text-zinc-200'}`}>
                    {opt.text}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-right flex-shrink-0">
                  <span className="text-xs font-bold text-white font-mono">{percentage}%</span>
                  <span className="text-[10px] text-zinc-400 font-mono">({opt.votes_count || 0})</span>
                </div>
              </div>

              {/* Voter Avatars / Names (if public) */}
              {!poll.is_anonymous && opt.voters && opt.voters.length > 0 && (
                <div className="relative z-10 mt-1.5 pt-1 border-t border-white/5 flex items-center gap-1 text-[10px] text-zinc-400">
                  <Users className="w-3 h-3 text-zinc-500" />
                  <span className="truncate">{opt.voters.join(', ')}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-2 border-t border-white/10">
        <span>{poll.total_votes || 0} total vote(s)</span>
        <span>Created by {poll.created_by?.username || 'Admin'}</span>
      </div>
    </div>
  );
};

export default PollCard;
