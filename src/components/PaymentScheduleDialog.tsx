import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Calendar, AlertTriangle, CheckCircle, Clock, Play } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PaymentScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  isCreator: boolean;
}

export function PaymentScheduleDialog({ 
  open, 
  onOpenChange, 
  groupId, 
  isCreator 
}: PaymentScheduleDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: groupData } = useQuery({
    queryKey: ['group-schedule', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('thrift_groups')
        .select(`
          *,
          group_members (
            id,
            user_id,
            payout_position
          )
        `)
        .eq('id', groupId)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;

      // Get profiles separately
      if (data.group_members && data.group_members.length > 0) {
        const userIds = data.group_members.map((m: any) => m.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', userIds);

        // Merge members with profiles
        (data as any).group_members = data.group_members.map((member: any) => ({
          ...member,
          profiles: profiles?.find(p => p.id === member.user_id)
        }));
      }

      return data as any;
    },
    enabled: !!groupId && open
  });

  const { data: contributions } = useQuery({
    queryKey: ['group-contributions', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contributions')
        .select('*')
        .eq('group_id', groupId)
        .order('cycle_number', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!groupId && open
  });

  const startContributionMutation = useMutation({
    mutationFn: async () => {
      // First check if payout order is finalized
      if (!groupData?.payout_order_finalized) {
        throw new Error('Please finalize payout order first');
      }

      // Create contribution schedule for all members
      const members = groupData.group_members;
      const totalCycles = members.length;
      const contributionAmount = groupData.contribution_amount;
      
      const contributions = [];
      for (let cycle = 1; cycle <= totalCycles; cycle++) {
        const dueDate = new Date();
        dueDate.setMonth(dueDate.getMonth() + cycle - 1);
        
        for (const member of members) {
          contributions.push({
            group_id: groupId,
            user_id: member.user_id,
            amount: contributionAmount,
            due_date: dueDate.toISOString().split('T')[0],
            cycle_number: cycle,
            status: 'pending'
          });
        }
      }

      const { error } = await supabase
        .from('contributions')
        .insert(contributions);

      if (error) throw error;

      // Update group status to active
      const { error: updateError } = await supabase
        .from('thrift_groups')
        .update({ status: 'active' })
        .eq('id', groupId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast({
        title: "Contributions Started",
        description: "Payment schedule has been created for all members.",
      });
      queryClient.invalidateQueries({ queryKey: ['group-contributions', groupId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start contributions",
        variant: "destructive",
      });
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Paid</Badge>;
      case 'late':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Late</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const getPayoutRecipient = (cycleNumber: number) => {
    const recipient = groupData?.group_members?.find((m: any) => m.payout_position === cycleNumber);
    if (recipient?.profiles) {
      return `${recipient.profiles.first_name} ${recipient.profiles.last_name}`;
    }
    return 'TBD';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Payment Schedule
          </DialogTitle>
          <DialogDescription>
            View and manage the group's contribution schedule
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {isCreator && groupData?.status === 'recruiting' && (
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <h3 className="font-semibold">Ready to Start Contributions?</h3>
                <p className="text-sm text-muted-foreground">
                  All {groupData.max_participants} members joined. Start the contribution cycle.
                </p>
              </div>
              <Button 
                onClick={() => startContributionMutation.mutate()}
                disabled={startContributionMutation.isPending}
              >
                <Play className="h-4 w-4 mr-2" />
                Start Contributions
              </Button>
            </div>
          )}

          {contributions && contributions.length > 0 ? (
            <div className="space-y-4">
              <h3 className="font-semibold">Contribution Cycles</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cycle</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Payout Recipient</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: groupData?.group_members?.length || 0 }, (_, i) => i + 1).map(cycle => {
                    const cycleContributions = contributions.filter(c => c.cycle_number === cycle);
                    const paidCount = cycleContributions.filter(c => c.status === 'paid').length;
                    const lateCount = cycleContributions.filter(c => c.status === 'late').length;
                    const dueDate = cycleContributions[0]?.due_date;
                    
                    return (
                      <TableRow key={cycle}>
                        <TableCell className="font-medium">Cycle {cycle}</TableCell>
                        <TableCell>{dueDate ? new Date(dueDate).toLocaleDateString() : 'TBD'}</TableCell>
                        <TableCell>{getPayoutRecipient(cycle)}</TableCell>
                        <TableCell>₦{groupData?.contribution_amount}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {lateCount > 0 && getStatusBadge('late')}
                            {paidCount === cycleContributions.length && cycleContributions.length > 0 ? 
                              getStatusBadge('paid') : 
                              getStatusBadge('pending')
                            }
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Payment Schedule Yet</h3>
              <p className="text-muted-foreground text-sm">
                Payment schedule will be created when contributions start.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}