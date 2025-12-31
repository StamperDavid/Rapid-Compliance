'use client';

/**
 * Add Section Dialog
 * 
 * Modal for adding hidden sections back to the document
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import type { SectionConfig } from '../ModularTemplateEditor';

interface AddSectionDialogProps {
  open: boolean;
  onClose: () => void;
  sections: SectionConfig[];
  onAddSection: (sectionId: string) => void;
}

export function AddSectionDialog({
  open,
  onClose,
  sections,
  onAddSection,
}: AddSectionDialogProps) {
  const hiddenSections = sections.filter(s => !s.visible);

  const handleAdd = (sectionId: string) => {
    onAddSection(sectionId);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Section</DialogTitle>
          <DialogDescription>
            Choose a section to add to your template document
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 mt-4">
          {hiddenSections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              All available sections are already visible in the document.
            </p>
          ) : (
            hiddenSections.map(section => (
              <Button
                key={section.id}
                variant="outline"
                className="w-full justify-between"
                onClick={() => handleAdd(section.id)}
              >
                <span>{section.title}</span>
                <div className="flex items-center gap-2">
                  {section.required && (
                    <Badge variant="outline" className="text-xs">
                      Required
                    </Badge>
                  )}
                  <Plus className="h-4 w-4" />
                </div>
              </Button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
