'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { auth } from '@/lib/firebase/config';
import { logger } from '@/lib/logger/logger';
import { PageTitle, SectionTitle, SectionDescription, CardTitle } from '@/components/ui/typography';
import { Switch } from '@/components/ui/switch';

const FILE = 'settings/automation/page.tsx';

interface ChannelAutoApprove {
  autoApprove: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

interface InboundAutomationConfig {
  xDmReply: ChannelAutoApprove;
}

interface ConfigResponse {
  success: boolean;
  config?: InboundAutomationConfig;
  error?: string;
}

const DEFAULT_CONFIG: InboundAutomationConfig = {
  xDmReply: { autoApprove: false },
};

export default function InboundAutomationSettingsPage(): React.JSX.Element {
  const { user } = useAuth();
  const toast = useToast();

  const [config, setConfig] = useState<InboundAutomationConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [savingChannel, setSavingChannel] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) { setLoading(false); return; }
      const resp = await fetch('/api/settings/automation/inbound', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const raw = (await resp.json()) as ConfigResponse;
      if (resp.ok && raw.success && raw.config) {
        setConfig(raw.config);
      }
    } catch (err) {
      logger.error(
        'Failed to load inbound automation config',
        err instanceof Error ? err : new Error(String(err)),
        { file: FILE },
      );
      toast.error('Could not load automation settings');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user) { void fetchConfig(); }
  }, [user, fetchConfig]);

  const handleToggle = async (channel: 'xDmReply', next: boolean): Promise<void> => {
    setSavingChannel(channel);
    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) { toast.error('Authentication required'); return; }
      const resp = await fetch('/api/settings/automation/inbound', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ channel, autoApprove: next }),
      });
      const raw = (await resp.json()) as ConfigResponse;
      if (resp.ok && raw.success && raw.config) {
        setConfig(raw.config);
        toast.success(
          next
            ? 'Auto-approve turned ON. Inbound DMs will now reply without operator review.'
            : 'Auto-approve turned OFF. Every inbound DM will wait for your review in Mission Control.',
        );
      } else {
        toast.error(raw.error ?? 'Failed to save');
      }
    } catch (err) {
      logger.error('Toggle save failed', err instanceof Error ? err : new Error(String(err)), { file: FILE });
      toast.error('Could not save the toggle');
    } finally {
      setSavingChannel(null);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <PageTitle>Inbound Automation</PageTitle>
        <SectionDescription>
          Choose which inbound channels reply automatically and which wait for your review in Mission Control.
        </SectionDescription>
      </div>

      <div className="bg-card border border-border-strong rounded-2xl p-6 space-y-4">
        <div>
          <SectionTitle>How auto-approve works</SectionTitle>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Every inbound message still goes through the full Jasper → Marketing Manager → channel specialist flow.
            The toggle below only changes whether you have to click &ldquo;Approve&rdquo; in Mission Control before the reply sends.
            With auto-approve OFF (the default), every reply waits for you to review the draft and click &ldquo;Send reply.&rdquo;
            With auto-approve ON, the same flow runs end-to-end without your click.
          </p>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Recommendation: leave auto-approve OFF until you have reviewed enough drafts on the channel to trust the agent&rsquo;s tone, accuracy, and judgment.
          </p>
        </div>
      </div>

      <div className="bg-card border border-border-strong rounded-2xl p-6 space-y-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <CardTitle>X (Twitter) DM auto-reply</CardTitle>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              When OFF: every inbound DM creates a mission in Mission Control with the X Expert&rsquo;s drafted reply for you to review and send.
              When ON: the same mission runs, but the dispatcher auto-approves and sends the reply with no operator click.
            </p>
            {config.xDmReply.updatedAt && (
              <p className="text-xs text-muted-foreground mt-3">
                Last changed: {new Date(config.xDmReply.updatedAt).toLocaleString()}
                {config.xDmReply.updatedBy ? ` by ${config.xDmReply.updatedBy}` : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{config.xDmReply.autoApprove ? 'On' : 'Off'}</span>
            <Switch
              checked={config.xDmReply.autoApprove}
              onCheckedChange={(next) => { void handleToggle('xDmReply', next); }}
              disabled={loading || savingChannel === 'xDmReply'}
              label="Auto-approve X DM replies"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
