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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Users, DollarSign, Calendar, Info } from 'lucide-react';

interface JoinGroupDialogProps {
  group: any;
  children: React.ReactNode;
}

const JoinGroupDialog = ({ group, children }: JoinGroupDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  const joinGroupMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('group_join_requests')
        .insert({
          user_id: user.id,
          group_id: group.id,
          message: message.trim() || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Join Request Sent",
        description: "Your request to join the group has been sent to the group admin for approval.",
      });
      queryClient.invalidateQueries({ queryKey: ['available-groups'] });
      setOpen(false);
      setMessage('');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast({
          title: "Already Requested",
          description: "You have already sent a join request for this group.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to send join request",
          variant: "destructive",
        });
      }
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const handleJoin = () => {
    joinGroupMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Join Group
          </DialogTitle>
          <DialogDescription>
            Review the group details and confirm your request to join "{group.name}".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Group Summary */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Group Name:</span>
                <span className="text-sm">{group.name}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Contribution:
                </span>
                <span className="text-sm font-medium text-primary">
                  {formatCurrency(group.contribution_amount)}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Frequency:
                </span>
                <span className="text-sm">{group.frequency}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Members:
                </span>
                <span className="text-sm">
                  {group.current_participants || 0}/{group.max_participants}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Important Information */}
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
                <div className="space-y-2">
                  <h4 className="font-medium text-warning">Important Information</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• By joining, you commit to regular contributions</li>
                    <li>• Payment schedule must be followed strictly</li>
                    <li>• Group admin will review your request</li>
                    <li>• You'll be notified once approved or rejected</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Optional Message */}
          <div className="space-y-2">
            <Label htmlFor="join-message">
              Message to Group Admin (Optional)
            </Label>
            <Textarea
              id="join-message"
              placeholder="Tell the group admin why you'd like to join..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleJoin}
              disabled={joinGroupMutation.isPending}
              className="flex-1"
            >
              {joinGroupMutation.isPending ? 'Sending...' : 'Send Request'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JoinGroupDialog;