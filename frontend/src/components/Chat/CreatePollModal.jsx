import React, { useState } from 'react';
import api from '../../api/axiosInstance';
import {
  X,
  BarChart3,
  Plus,
  Trash2,
  Check,
  Loader2,
  HelpCircle,
  Users,
} from 'lucide-react';

export const CreatePollModal = ({ isOpen, onClose, roomId, onPollCreated }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isMultipleChoice, setIsMultipleChoice] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleOptionChange = (index, value) => {
    const next = [...options];
    next[index] = value;
    setOptions(next);
  };

  const handleAddOption = () => {
    if (options.length < 8) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validOptions = options.map((o) => o.trim()).filter(Boolean);

    if (!question.trim()) {
      alert('Please enter a poll question.');
      return;
    }
    if (validOptions.length < 2) {
      alert('Please enter at least 2 voting options.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.post(`/api/chat/rooms/${roomId}/polls/`, {
        question: question.trim(),
        options: validOptions,
        is_multiple_choice: isMultipleChoice,
        is_anonymous: isAnonymous,
      });

      if (onPollCreated) onPollCreated(res.data);
      onClose();
    } catch (err) {
      console.error('Failed to create poll:', err);
      alert(err.response?.data?.error || 'Failed to create poll.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in select-none">
      <div className="w-full max-w-md rounded-3xl bg-[#121216] border border-white/15 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-black/40 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Create Live Poll</h3>
              <p className="text-[10px] text-zinc-400">Real-time voting in chat</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Question Input */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1">
              Poll Question
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question..."
              maxLength={250}
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Options */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5">
              Poll Options (2-8)
            </label>
            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    maxLength={100}
                    className="flex-1 px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {options.length < 8 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="mt-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Option</span>
              </button>
            )}
          </div>

          {/* Settings Toggles */}
          <div className="pt-2 border-t border-white/10 space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-white/5 transition-colors">
              <div>
                <span className="text-xs font-bold text-white block">Multiple Answers</span>
                <span className="text-[10px] text-zinc-400">Allow users to select multiple options</span>
              </div>
              <input
                type="checkbox"
                checked={isMultipleChoice}
                onChange={(e) => setIsMultipleChoice(e.target.checked)}
                className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-white/5 transition-colors">
              <div>
                <span className="text-xs font-bold text-white block">Anonymous Voting</span>
                <span className="text-[10px] text-zinc-400">Keep individual voter names hidden</span>
              </div>
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
              />
            </label>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-dark px-4 py-2 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary px-5 py-2 text-xs font-bold flex items-center gap-2 shadow-lg disabled:opacity-40"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : (
                <>
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Send Poll</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePollModal;
