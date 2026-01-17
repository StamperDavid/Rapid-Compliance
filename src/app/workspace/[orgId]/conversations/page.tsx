'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  User,
  Clock,
  Mail,
  Phone,
  MessageCircle,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  Eye,
  GraduationCap,
  X,
  Send,
  Activity,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import type { ChatSession, ChatMessage } from '@/lib/agent/chat-session-service';
import { ChatSessionService } from '@/lib/agent/chat-session-service';
import { logger } from '@/lib/logger/logger';

export default function ConversationsPage() {
  const { user } = useAuth();
  const params = useParams();
  const orgId = params.orgId as string;
  const { theme } = useOrgTheme();
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  // Real data states
  const [liveConversations, setLiveConversations] = useState<ChatSession[]>([]);
  const [completedConversations, setCompletedConversations] = useState<ChatSession[]>([]);
  const [selectedMessages, setSelectedMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to real-time active sessions
  useEffect(() => {
    if (!orgId) return;

    setLoading(true);
    setError(null);

    // Subscribe to active sessions
    const unsubscribe = ChatSessionService.subscribeToActiveSessions(
      orgId,
      (sessions) => {
        setLiveConversations(sessions);
        setLoading(false);
      }
    );

    // Load history
    ChatSessionService.getSessionHistory(orgId, 50)
      .then(setCompletedConversations)
      .catch((err) => {
        logger.error('Failed to load history:', err, { file: 'page.tsx' });
      });

    return () => unsubscribe();
  }, [orgId]);

  // Load messages when conversation is selected
  useEffect(() => {
    if (!selectedConversation || !orgId) {
      setSelectedMessages([]);
      return;
    }

    const unsubscribe = ChatSessionService.subscribeToSessionMessages(
      orgId,
      selectedConversation,
      setSelectedMessages
    );

    return () => unsubscribe();
  }, [selectedConversation, orgId]);

  const formatTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return date.toLocaleDateString();
  };

  const handleTakeOver = async (conversationId: string) => {
    try {
      if (!user?.id) {
        alert('You must be logged in to take over a conversation.');
        return;
      }
      await ChatSessionService.requestTakeover(orgId, conversationId, user.id, 'Manual takeover');
      alert(`Taking over conversation. You are now connected to the customer chat.`);
    } catch (err: unknown) {
      logger.error('Failed to take over:', err instanceof Error ? err : new Error(String(err)), { file: 'page.tsx' });
      alert('Failed to take over conversation. Please try again.');
    }
  };

  const handleSendToTraining = async (conversationId: string, issue: string) => {
    try {
      await ChatSessionService.flagForTraining(orgId, conversationId, issue);

      // Update local state
      setCompletedConversations(prev =>
        prev.map(c => c.id === conversationId ? { ...c, flaggedForTraining: true, trainingIssue: issue } as any : c)
      );

      alert(`Conversation sent to Training Center for improvement.`);
    } catch (err: unknown) {
      logger.error('Failed to flag for training:', err instanceof Error ? err : new Error(String(err)), { file: 'page.tsx' });
      alert('Failed to send to training. Please try again.');
    }
  };

  const needsAttentionCount = liveConversations.filter(c => c.status === 'needs_help').length;
  const flaggedCount = completedConversations.filter((c: any) => c.flaggedForTraining).length;

  const getChannelBadge = (channel?: string) => {
    switch (channel) {
      case 'email':
        return {
          icon: <Mail className="w-3 h-3" />,
          label: 'Email',
          gradient: 'from-purple-500 to-pink-500'
        };
      case 'sms':
        return {
          icon: <Phone className="w-3 h-3" />,
          label: 'SMS',
          gradient: 'from-green-500 to-emerald-500'
        };
      case 'chat':
      default:
        return {
          icon: <MessageCircle className="w-3 h-3" />,
          label: 'Chat',
          gradient: 'from-sky-500 to-blue-500'
        };
    }
  };

  return (
    <div className="flex flex-col min-h-0 h-full bg-black">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-8 border-b border-white/10"
      >
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-blue-500 flex items-center justify-center shadow-lg shadow-sky-500/25">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Live Conversations</h1>
            <p className="text-sm text-white/60">Monitor active customer sessions and review past conversations</p>
          </div>
        </div>
      </motion.div>

      {/* Status Bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="px-8 py-4 bg-black/40 backdrop-blur-xl border-b border-white/10"
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping opacity-75" />
            </div>
            <span className="text-sm font-semibold text-white/80">
              {liveConversations.filter(c => c.status === 'active').length} Active
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <div className="absolute inset-0 w-3 h-3 bg-red-500 rounded-full animate-ping opacity-75" />
            </div>
            <span className="text-sm font-semibold text-white/80">
              {needsAttentionCount} Need Attention
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2 text-sm text-white/40">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Real-time updates
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex gap-4 px-8 border-b border-white/10"
      >
        {[
          { id: 'active', label: 'Active Conversations', badge: needsAttentionCount, icon: Activity },
          { id: 'history', label: 'Conversation History', badge: flaggedCount, icon: Clock }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              setSelectedConversation(null);
            }}
            className="relative px-6 py-4 flex items-center gap-2 text-sm font-semibold transition-all"
          >
            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-sky-500' : 'text-white/40'}`} />
            <span className={activeTab === tab.id ? 'text-sky-500' : 'text-white/40'}>
              {tab.label}
            </span>
            {tab.badge > 0 && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] text-center">
                {tab.badge}
              </span>
            )}
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-sky-500 to-blue-500"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        ))}
      </motion.div>

      {/* Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16"
          >
            <RefreshCw className="w-12 h-12 text-sky-500 animate-spin mb-4" />
            <p className="text-white/60">Loading conversations...</p>
          </motion.div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16"
          >
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-red-500">{error}</p>
          </motion.div>
        ) : (
          <>
            {/* Active Conversations Tab */}
            <AnimatePresence mode="wait">
              {activeTab === 'active' && (
                <motion.div
                  key="active"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="max-w-7xl mx-auto"
                >
                  {liveConversations.length === 0 ? (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-16 text-center"
                    >
                      <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-sky-500/20 to-blue-500/20 flex items-center justify-center">
                        <MessageSquare className="w-10 h-10 text-sky-500" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">No active conversations</h3>
                      <p className="text-sm text-white/60">Conversations will appear here when customers start chatting with your AI agent</p>
                    </motion.div>
                  ) : (
                    <div className={`grid gap-6 ${selectedConversation ? 'grid-cols-[400px_1fr]' : 'grid-cols-1'}`}>
                      {/* Conversation List */}
                      <div className="flex flex-col gap-4">
                        {liveConversations.map((conv, index) => {
                          const channelBadge = getChannelBadge((conv as any).channel);
                          return (
                            <motion.div
                              key={conv.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              onClick={() => setSelectedConversation(conv.id)}
                              className={`relative bg-black/40 backdrop-blur-xl border-2 rounded-2xl p-6 cursor-pointer transition-all hover:bg-black/60 ${
                                selectedConversation === conv.id
                                  ? 'border-sky-500 shadow-lg shadow-sky-500/25'
                                  : conv.status === 'needs_help'
                                  ? 'border-red-500 shadow-lg shadow-red-500/25'
                                  : 'border-white/10'
                              }`}
                            >
                              {conv.status === 'needs_help' && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="absolute -top-3 right-6 px-3 py-1 bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold rounded-full flex items-center gap-1 shadow-lg"
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                  NEEDS ATTENTION
                                </motion.div>
                              )}

                              {/* Channel Badge */}
                              <div className="mb-4">
                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r ${channelBadge.gradient} text-white text-xs font-semibold`}>
                                  {channelBadge.icon}
                                  {channelBadge.label}
                                </div>
                              </div>

                              {/* Customer Info */}
                              <div className="mb-4">
                                <div className="flex items-center gap-2 mb-1">
                                  <User className="w-4 h-4 text-sky-500" />
                                  <h3 className="text-white font-semibold">
                                    {conv.customerName || 'Anonymous Customer'}
                                  </h3>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-white/60">
                                  <Clock className="w-3 h-3" />
                                  {conv.customerEmail || conv.customerId} • Started {formatTimeAgo(conv.startedAt)}
                                </div>
                              </div>

                              {/* Last Message */}
                              {conv.lastMessage && (
                                <div className="bg-black/60 border border-white/10 rounded-xl p-3 mb-4">
                                  <p className="text-sm text-white/80 line-clamp-2 italic">
                                    "{conv.lastMessage}"
                                  </p>
                                </div>
                              )}

                              {/* Stats */}
                              <div className="flex gap-4 mb-4">
                                <div className="flex-1 bg-black/60 rounded-xl p-3 border border-white/10">
                                  <div className="text-xs text-white/60 mb-1">Messages</div>
                                  <div className="text-lg font-bold text-white">{conv.messageCount}</div>
                                </div>
                                <div className="flex-1 bg-black/60 rounded-xl p-3 border border-white/10">
                                  <div className="text-xs text-white/60 mb-1">Sentiment</div>
                                  <div className={`text-xs font-bold ${
                                    conv.sentiment === 'positive' ? 'text-green-500' :
                                    conv.sentiment === 'frustrated' ? 'text-red-500' :
                                    'text-yellow-500'
                                  }`}>
                                    {conv.sentiment?.toUpperCase() || 'NEUTRAL'}
                                  </div>
                                </div>
                              </div>

                              {/* Action Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTakeOver(conv.id);
                                }}
                                className={`w-full px-4 py-3 rounded-xl font-semibold text-white shadow-lg transition-all ${
                                  conv.status === 'needs_help'
                                    ? 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 shadow-red-500/25'
                                    : 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 shadow-sky-500/25'
                                }`}
                              >
                                <div className="flex items-center justify-center gap-2">
                                  <Send className="w-4 h-4" />
                                  {conv.status === 'needs_help' ? 'Take Over Now' : 'Take Over Conversation'}
                                </div>
                              </button>
                            </motion.div>
                          );
                        })}
                      </div>

                      {/* Conversation Detail View */}
                      <AnimatePresence>
                        {selectedConversation && (
                          <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col h-[700px]"
                          >
                            {/* Detail Header */}
                            <div className="flex items-center justify-between p-6 border-b border-white/10">
                              <div>
                                <h3 className="text-xl font-bold text-white mb-1">
                                  {liveConversations.find(c => c.id === selectedConversation)?.customerName || 'Anonymous'}
                                </h3>
                                <div className="flex items-center gap-2 text-sm text-white/60">
                                  <Mail className="w-4 h-4" />
                                  {liveConversations.find(c => c.id === selectedConversation)?.customerEmail || 'No email provided'}
                                </div>
                              </div>
                              <button
                                onClick={() => setSelectedConversation(null)}
                                className="p-2 rounded-xl bg-black/60 hover:bg-black/80 border border-white/10 transition-all"
                              >
                                <X className="w-5 h-5 text-white" />
                              </button>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 p-6 overflow-y-auto space-y-4">
                              {selectedMessages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-white/60">
                                  <MessageSquare className="w-12 h-12 mb-4 opacity-40" />
                                  <p>No messages yet</p>
                                </div>
                              ) : (
                                selectedMessages.map((msg, index) => (
                                  <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.02 }}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                  >
                                    <div
                                      className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                                        msg.role === 'user'
                                          ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white'
                                          : 'bg-black/60 border border-white/10 text-white/80'
                                      }`}
                                    >
                                      <div className={`text-xs mb-1 ${msg.role === 'user' ? 'text-white/80' : 'text-white/60'}`}>
                                        {msg.role === 'user' ? 'Customer' : msg.role === 'assistant' ? 'AI Agent' : msg.role === 'agent' ? 'Human Agent' : 'System'} • {new Date(msg.timestamp).toLocaleTimeString()}
                                      </div>
                                      <div className="text-sm">{msg.content}</div>
                                    </div>
                                  </motion.div>
                                ))
                              )}
                            </div>

                            {/* Action Footer */}
                            <div className="p-6 border-t border-white/10">
                              <button
                                onClick={() => handleTakeOver(selectedConversation)}
                                className="w-full px-6 py-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-semibold rounded-xl shadow-lg shadow-red-500/25 transition-all"
                              >
                                <div className="flex items-center justify-center gap-2">
                                  <Send className="w-5 h-5" />
                                  Take Over This Conversation
                                </div>
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Conversation History Tab */}
              {activeTab === 'history' && (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="max-w-7xl mx-auto"
                >
                  {completedConversations.length === 0 ? (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-16 text-center"
                    >
                      <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-sky-500/20 to-blue-500/20 flex items-center justify-center">
                        <Clock className="w-10 h-10 text-sky-500" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">No conversation history</h3>
                      <p className="text-sm text-white/60">Completed conversations will appear here</p>
                    </motion.div>
                  ) : (
                    <div className="space-y-4">
                      {completedConversations.map((conv: any, index) => {
                        const channelBadge = getChannelBadge(conv.channel);
                        return (
                          <motion.div
                            key={conv.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`relative bg-black/40 backdrop-blur-xl border-2 rounded-2xl p-6 ${
                              conv.flaggedForTraining ? 'border-red-500 shadow-lg shadow-red-500/25' : 'border-white/10'
                            }`}
                          >
                            {conv.flaggedForTraining && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-3 right-6 px-3 py-1 bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold rounded-full flex items-center gap-1 shadow-lg"
                              >
                                <AlertTriangle className="w-3 h-3" />
                                FLAGGED FOR RETRAINING
                              </motion.div>
                            )}

                            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-6">
                              {/* Customer Info */}
                              <div>
                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 mb-3 rounded-full bg-gradient-to-r ${channelBadge.gradient} text-white text-xs font-semibold`}>
                                  {channelBadge.icon}
                                  {channelBadge.label}
                                </div>
                                <div className="flex items-center gap-2 mb-1">
                                  <User className="w-4 h-4 text-sky-500" />
                                  <h3 className="text-white font-semibold">
                                    {conv.customerName || 'Anonymous'}
                                  </h3>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-white/60">
                                  <Clock className="w-3 h-3" />
                                  {conv.completedAt ? new Date(conv.completedAt).toLocaleString() : 'Unknown'}
                                </div>
                              </div>

                              {/* Messages */}
                              <div className="bg-black/60 rounded-xl p-3 border border-white/10">
                                <div className="text-xs text-white/60 mb-1">Messages</div>
                                <div className="text-lg font-bold text-white">{conv.messageCount}</div>
                              </div>

                              {/* Status */}
                              <div className="bg-black/60 rounded-xl p-3 border border-white/10">
                                <div className="text-xs text-white/60 mb-1">Status</div>
                                <div className={`text-xs font-bold ${
                                  conv.status === 'completed' ? 'text-green-500' : 'text-yellow-500'
                                }`}>
                                  {conv.status?.toUpperCase() || 'COMPLETED'}
                                </div>
                              </div>

                              {/* Sentiment */}
                              <div className="bg-black/60 rounded-xl p-3 border border-white/10">
                                <div className="text-xs text-white/60 mb-1">Sentiment</div>
                                <div className={`text-xs font-bold ${
                                  conv.sentiment === 'positive' ? 'text-green-500' :
                                  conv.sentiment === 'frustrated' ? 'text-red-500' :
                                  'text-yellow-500'
                                }`}>
                                  {conv.sentiment?.toUpperCase() || 'NEUTRAL'}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedConversation(conv.id);
                                    ChatSessionService.getSessionMessages(orgId, conv.id).then(setSelectedMessages);
                                  }}
                                  className="flex-1 px-3 py-2 bg-black/60 hover:bg-black/80 text-white border border-white/10 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1"
                                >
                                  <Eye className="w-3 h-3" />
                                  View
                                </button>
                                {!conv.flaggedForTraining && (
                                  <button
                                    onClick={() => handleSendToTraining(conv.id, 'Manual review')}
                                    className="flex-1 px-3 py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-1"
                                  >
                                    <GraduationCap className="w-3 h-3" />
                                    Train
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Training Issue */}
                            {conv.trainingIssue && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl"
                              >
                                <div className="flex items-center gap-2 text-red-500 text-xs font-semibold">
                                  <AlertCircle className="w-4 h-4" />
                                  ISSUE: {conv.trainingIssue}
                                </div>
                              </motion.div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}
