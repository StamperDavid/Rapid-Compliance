'use client';

/**
 * Discovery Result Detail Modal
 *
 * Shows full enrichment data, ICP score breakdown, and action buttons
 * for a single discovery result.
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Building2,
  Globe,
  Users,
  MapPin,
  Cpu,
  TrendingUp,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface CompanyData {
  companyName?: string;
  domain?: string;
  website?: string;
  industry?: string;
  description?: string;
  companySize?: string;
  employeeCount?: number;
  employeeRange?: string;
  city?: string;
  state?: string;
  country?: string;
  fundingStage?: string;
  techStack?: string[];
  [key: string]: unknown;
}

interface DiscoveryResult {
  id: string;
  batchId: string;
  icpProfileId: string;
  companyData: CompanyData;
  icpScore: number;
  icpScoreBreakdown: Record<string, number>;
  status: 'pending' | 'approved' | 'rejected' | 'converted';
  reviewedBy?: string;
  leadId?: string;
}

interface Props {
  result: DiscoveryResult;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onConvert: (id: string) => void;
}

const SCORE_LABELS: Record<string, string> = {
  industry: 'Industry',
  companySize: 'Company Size',
  location: 'Location',
  techStack: 'Tech Stack',
  fundingStage: 'Funding Stage',
  title: 'Job Title',
  seniority: 'Seniority',
};

export default function DiscoveryResultDetail({ result, onClose, onApprove, onReject, onConvert }: Props) {
  const company = result.companyData;

  const scoreColor = (score: number) => {
    if (score >= 7) {return 'bg-green-500';}
    if (score >= 4) {return 'bg-yellow-500';}
    return 'bg-red-500';
  };

  const overallColor = (score: number) => {
    if (score >= 70) {return 'text-green-400';}
    if (score >= 40) {return 'text-yellow-400';}
    return 'text-red-400';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10"
        style={{ backgroundColor: 'var(--color-bg-main)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-white/10" style={{ backgroundColor: 'var(--color-bg-main)' }}>
          <div>
            <h2 className="text-lg font-bold text-white">
              {company.companyName ?? company.domain ?? 'Unknown Company'}
            </h2>
            {company.domain && (
              <a
                href={`https://${company.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <Globe className="w-3 h-3" />
                {company.domain}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* ICP Score */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className={`text-4xl font-bold ${overallColor(result.icpScore)}`}>{result.icpScore}</div>
              <div className="text-xs text-white/40 mt-1">ICP Score</div>
            </div>
            <div className="flex-1 space-y-1.5">
              {Object.entries(result.icpScoreBreakdown).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-24 text-xs text-white/50">{SCORE_LABELS[key] ?? key}</span>
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${scoreColor(value)} transition-all`}
                      style={{ width: `${(value / 10) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-xs text-white/40 text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Company Details */}
          <div className="grid grid-cols-2 gap-4">
            {company.industry && (
              <div className="flex items-start gap-2">
                <Building2 className="w-4 h-4 text-white/30 mt-0.5 shrink-0" />
                <div>
                  <div className="text-[10px] text-white/40 uppercase">Industry</div>
                  <div className="text-sm text-white">{company.industry}</div>
                </div>
              </div>
            )}
            {(company.employeeCount ?? company.companySize ?? company.employeeRange) && (
              <div className="flex items-start gap-2">
                <Users className="w-4 h-4 text-white/30 mt-0.5 shrink-0" />
                <div>
                  <div className="text-[10px] text-white/40 uppercase">Size</div>
                  <div className="text-sm text-white">
                    {company.employeeCount ? `${company.employeeCount} employees` : company.employeeRange ?? company.companySize}
                  </div>
                </div>
              </div>
            )}
            {(company.city ?? company.state ?? company.country) && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-white/30 mt-0.5 shrink-0" />
                <div>
                  <div className="text-[10px] text-white/40 uppercase">Location</div>
                  <div className="text-sm text-white">
                    {[company.city, company.state, company.country].filter(Boolean).join(', ')}
                  </div>
                </div>
              </div>
            )}
            {company.fundingStage && (
              <div className="flex items-start gap-2">
                <TrendingUp className="w-4 h-4 text-white/30 mt-0.5 shrink-0" />
                <div>
                  <div className="text-[10px] text-white/40 uppercase">Funding</div>
                  <div className="text-sm text-white">{company.fundingStage}</div>
                </div>
              </div>
            )}
          </div>

          {/* Tech Stack */}
          {company.techStack && Array.isArray(company.techStack) && company.techStack.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="w-4 h-4 text-white/30" />
                <span className="text-[10px] text-white/40 uppercase">Tech Stack</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {company.techStack.map((tech: string) => (
                  <span key={tech} className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-xs text-white/60">
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {company.description && (
            <div>
              <div className="text-[10px] text-white/40 uppercase mb-1">Description</div>
              <p className="text-sm text-white/70">{company.description}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            {result.status === 'pending' && (
              <>
                <button
                  onClick={() => onApprove(result.id)}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 rounded-xl transition-colors font-medium text-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve
                </button>
                <button
                  onClick={() => onReject(result.id)}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-xl transition-colors font-medium text-sm"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
              </>
            )}
            {result.status === 'approved' && (
              <button
                onClick={() => onConvert(result.id)}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white rounded-xl transition-all font-medium text-sm"
              >
                <ArrowRight className="w-4 h-4" />
                Convert to CRM Lead
              </button>
            )}
            {result.status === 'converted' && (
              <div className="flex-1 text-center py-2.5 text-violet-400/60 text-sm">
                Already converted to CRM
              </div>
            )}
            {result.status === 'rejected' && (
              <div className="flex-1 text-center py-2.5 text-red-400/60 text-sm">
                Rejected
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
