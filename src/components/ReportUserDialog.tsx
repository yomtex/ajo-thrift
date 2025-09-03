import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle } from 'lucide-react';

interface ReportUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  userId: string;
}

export function ReportUserDialog({ open, onOpenChange, groupId, userId }: ReportUserDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reportType, setReportType] = useState<string>('');
  const [description, setDescription] = useState('');

  const reportUserMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !reportType.trim()) {
        throw new Error('Missing required fields');
      }

      const { error } = await supabase
        .from('user_reports')
        .insert({
          reporter_id: user.id,
          reported_user_id: userId,
          group_id: groupId,
          report_type: reportType,
          description: description.trim() || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Report Submitted",
        description: "Your report has been submitted and will be reviewed by administrators.",
      });
      onOpenChange(false);
      setReportType('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['user-reports', groupId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit report",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    reportUserMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Report User
          </DialogTitle>
          <DialogDescription>
            Report a user for policy violations or inappropriate behavior. All reports are reviewed by administrators.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-type">Report Type *</Label>
            <Select value={reportType} onValueChange={setReportType} required>
              <SelectTrigger id="report-type">
                <SelectValue placeholder="Select a reason for reporting" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="late_payment">Late Payment</SelectItem>
                <SelectItem value="scam">Suspected Scam</SelectItem>
                <SelectItem value="inappropriate_behavior">Inappropriate Behavior</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Additional Details</Label>
            <Textarea
              id="description"
              placeholder="Provide additional context about your report..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> False reports may result in penalties. Only report genuine violations or concerns.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!reportType || reportUserMutation.isPending}
              className="flex-1"
            >
              {reportUserMutation.isPending ? 'Submitting...' : 'Submit Report'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}