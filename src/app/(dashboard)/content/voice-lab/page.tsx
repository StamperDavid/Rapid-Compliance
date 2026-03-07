'use client';

import { useState } from 'react';
import { Mic, Music, AudioWaveform, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SubpageNav from '@/components/ui/SubpageNav';
import { VIDEO_TABS } from '@/lib/constants/subpage-nav';
import { VoiceRecorderStudio } from './components/VoiceRecorderStudio';
import { VoiceLibrary } from './components/VoiceLibrary';
import { VoiceDesigner } from './components/VoiceDesigner';
import { AIMusicStudio } from './components/AIMusicStudio';

type VoiceLabTab = 'studio' | 'voices' | 'designer' | 'music';

const TABS: { key: VoiceLabTab; label: string; icon: React.ElementType; description: string }[] = [
  { key: 'studio', label: 'Studio', icon: Mic, description: 'Record & edit' },
  { key: 'voices', label: 'My Voices', icon: AudioWaveform, description: 'Voice library' },
  { key: 'designer', label: 'Designer', icon: Wand2, description: 'Create voices' },
  { key: 'music', label: 'AI Music', icon: Music, description: 'Generate songs' },
];

export default function VoiceLabPage() {
  const [activeTab, setActiveTab] = useState<VoiceLabTab>('studio');

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900 p-6">
      {/* Video Hub Navigation */}
      <SubpageNav items={VIDEO_TABS} />

      {/* Header */}
      <div className="border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <AudioWaveform className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Voice Lab</h1>
              <p className="text-xs text-zinc-500">Record, clone, design custom voices, and create AI music — all in one studio</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'text-white'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="voicelab-tab"
                      className="absolute inset-0 bg-zinc-800 rounded-lg"
                      transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                  <span className="relative flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    {tab.label}
                    <span className="hidden sm:inline text-[10px] text-zinc-500 font-normal">
                      {tab.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'studio' && <VoiceRecorderStudio />}
            {activeTab === 'voices' && <VoiceLibrary />}
            {activeTab === 'designer' && <VoiceDesigner />}
            {activeTab === 'music' && <AIMusicStudio />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
