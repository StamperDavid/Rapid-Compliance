'use client';

/**
 * GoogleBusinessComposer — Native Google Business Profile composer.
 *
 * - `post`: 1500 char update + CTA selector + URL
 * - `offer`: title + offer details + optional coupon code
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PLATFORM_META } from '@/lib/social/platform-config';
import type { PlatformComposerFormProps } from './PlatformComposer';
import { useCharCountdownColor } from './_utils';

const MAX_POST = 1500;
const meta = PLATFORM_META.google_business;

const CTA_OPTIONS = [
  { value: 'LEARN_MORE', label: 'Learn More' },
  { value: 'BOOK', label: 'Book' },
  { value: 'ORDER', label: 'Order Online' },
  { value: 'SHOP', label: 'Shop' },
  { value: 'SIGN_UP', label: 'Sign Up' },
  { value: 'CALL', label: 'Call' },
];

export function GoogleBusinessComposer({
  value,
  onChange,
  disabled,
}: PlatformComposerFormProps): React.ReactElement {
  const isOffer = value.contentType === 'offer';
  const countdownColor = useCharCountdownColor(value.content.length, MAX_POST);

  const setContentType = (next: 'post' | 'offer') => {
    onChange({ ...value, contentType: next });
  };

  const setContent = (content: string) => {
    onChange({ ...value, content });
  };

  const setMetaField = (key: string, val: string) => {
    onChange({ ...value, metadata: { ...value.metadata, [key]: val } });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={!isOffer ? 'default' : 'outline'}
          onClick={() => setContentType('post')}
          disabled={disabled}
        >
          Update
        </Button>
        <Button
          type="button"
          size="sm"
          variant={isOffer ? 'default' : 'outline'}
          onClick={() => setContentType('offer')}
          disabled={disabled}
        >
          Offer
        </Button>
      </div>

      {isOffer && (
        <div>
          <label className="text-sm font-medium text-foreground" htmlFor="gb-offer-title">
            Offer title <span className="text-destructive">*</span>
          </label>
          <Input
            id="gb-offer-title"
            value={value.metadata.title ?? ''}
            onChange={(e) => setMetaField('title', e.target.value)}
            placeholder="20% Off This Week"
            disabled={disabled}
            className="mt-1"
            style={{ borderColor: meta.color }}
          />
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-foreground" htmlFor="gb-content">
          {isOffer ? 'Offer details' : 'Update'}
        </label>
        <div className="relative mt-1">
          <Textarea
            id="gb-content"
            value={value.content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              isOffer
                ? 'Describe the offer — what, when, who qualifies.'
                : 'Share a business update with your local audience.'
            }
            rows={5}
            maxLength={isOffer ? undefined : MAX_POST}
            disabled={disabled}
            className="resize-none pr-16"
            style={{ borderColor: meta.color }}
          />
          {!isOffer && (
            <div className={`absolute bottom-2 right-3 text-xs font-medium ${countdownColor}`}>
              {MAX_POST - value.content.length}
            </div>
          )}
        </div>
      </div>

      {isOffer ? (
        <div>
          <label className="text-sm font-medium text-foreground" htmlFor="gb-coupon">
            Coupon code (optional)
          </label>
          <Input
            id="gb-coupon"
            value={value.metadata.couponCode ?? ''}
            onChange={(e) => setMetaField('couponCode', e.target.value)}
            placeholder="SAVE20"
            disabled={disabled}
            className="mt-1"
          />
        </div>
      ) : (
        <>
          <div>
            <label className="text-sm font-medium text-foreground" htmlFor="gb-cta">
              Call to action
            </label>
            <select
              id="gb-cta"
              value={value.metadata.callToAction ?? ''}
              onChange={(e) => setMetaField('callToAction', e.target.value)}
              disabled={disabled}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">No CTA</option>
              {CTA_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground" htmlFor="gb-cta-url">
              CTA link
            </label>
            <Input
              id="gb-cta-url"
              type="url"
              value={value.metadata.ctaUrl ?? ''}
              onChange={(e) => setMetaField('ctaUrl', e.target.value)}
              placeholder="https://your-site.com"
              disabled={disabled}
              className="mt-1"
            />
          </div>
        </>
      )}
    </div>
  );
}

export default GoogleBusinessComposer;
