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
import { DollarSign, CheckCircle, Clock, AlertTriangle, Send } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PayoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  isCreator: boolean;
}

export function PayoutDialog({ 
  open, 
  onOpenChange, 
  groupId, 
  isCreator 
}: PayoutDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: groupData } = useQuery({
    queryKey: ['group-payout-data', groupId],
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
    queryKey: ['cycle-contributions', groupId],
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

  const { data: payouts } = useQuery({
    queryKey: ['group-payouts', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payouts')
        .select('*')
        .eq('group_id', groupId)
        .order('cycle_number', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!groupId && open
  });

  const processPayoutMutation = useMutation({
    mutationFn: async (cycleNumber: number) => {
      // Check if all contributions for this cycle are paid
      const cycleContributions = contributions?.filter(c => c.cycle_number === cycleNumber) || [];
      const unpaidContributions = cycleContributions.filter(c => c.status !== 'paid');
      
      if (unpaidContributions.length > 0) {
        throw new Error(`Cannot process payout: ${unpaidContributions.length} contributions still pending`);
      }

      // Find recipient for this cycle
      const recipient = groupData?.group_members?.find((m: any) => m.payout_position === cycleNumber);
      if (!recipient) {
        throw new Error('No recipient found for this cycle');
      }

      // Calculate total payout amount
      const totalAmount = cycleContributions.reduce((sum, c) => sum + Number(c.amount), 0);

      // Create payout record
      const { error } = await supabase
        .from('payouts')
        .insert({
          group_id: groupId,
          recipient_user_id: recipient.user_id,
          cycle_number: cycleNumber,
          amount: totalAmount,
          status: 'completed'
        });

      if (error) throw error;
    },
    onSuccess: (_, cycleNumber) => {
      toast({
        title: "Payout Processed",
        description: `Cycle ${cycleNumber} payout has been processed successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['group-payouts', groupId] });
    },
    onError: (error: any) => {
      toast({
        title: "Payout Error",
        description: error.message || "Failed to process payout",
        variant: "destructive",
      });
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'pending':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Not Started</Badge>;
    }
  };

  const getCycleStatus = (cycleNumber: number) => {
    const cycleContributions = contributions?.filter(c => c.cycle_number === cycleNumber) || [];
    const paidCount = cycleContributions.filter(c => c.status === 'paid').length;
    const totalCount = cycleContributions.length;
    const payout = payouts?.find(p => p.cycle_number === cycleNumber);

    if (payout?.status === 'completed') {
      return { status: 'completed', canPayout: false, message: 'Payout completed' };
    }
    
    if (paidCount === totalCount && totalCount > 0) {
      return { status: 'ready', canPayout: true, message: 'Ready for payout' };
    }
    
    if (paidCount > 0) {
      return { status: 'partial', canPayout: false, message: `${paidCount}/${totalCount} paid` };
    }
    
    return { status: 'pending', canPayout: false, message: 'Waiting for contributions' };
  };

  const getRecipientName = (cycleNumber: number) => {
    const recipient = groupData?.group_members?.find((m: any) => m.payout_position === cycleNumber);
    if (recipient?.profiles) {
      return `${recipient.profiles.first_name} ${recipient.profiles.last_name}`;
    }
    return 'Unknown';
  };

  const totalCycles = groupData?.group_members?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Payout Management
          </DialogTitle>
          <DialogDescription>
            Process payouts when all contributions for a cycle are complete
          </DialogDescription>
        </DialogHeader>

        {groupData?.status !== 'active' ? (
          <Card>
            <CardContent className="p-6 text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Group Not Active</h3>
              <p className="text-muted-foreground">
                Payouts can only be processed when the group is active and contributions have started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Cycles</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalCycles}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Completed Payouts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {payouts?.filter(p => p.status === 'completed').length || 0}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Paid Out</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ₦{payouts?.filter(p => p.status === 'completed')
                      .reduce((sum, p) => sum + Number(p.amount), 0).toFixed(2) || '0.00'}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Payout Schedule</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cycle</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    {isCreator && <TableHead>Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: totalCycles }, (_, i) => i + 1).map(cycle => {
                    const status = getCycleStatus(cycle);
                    const payout = payouts?.find(p => p.cycle_number === cycle);
                    const cycleContributions = contributions?.filter(c => c.cycle_number === cycle) || [];
                    const totalAmount = cycleContributions.reduce((sum, c) => sum + Number(c.amount), 0);
                    
                    return (
                      <TableRow key={cycle}>
                        <TableCell className="font-medium">Cycle {cycle}</TableCell>
                        <TableCell>{getRecipientName(cycle)}</TableCell>
                        <TableCell>₦{totalAmount.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(payout?.status || 'not_started')}
                            <span className="text-sm text-muted-foreground">
                              {status.message}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {payout?.payout_date ? 
                            new Date(payout.payout_date).toLocaleDateString() : 
                            '-'
                          }
                        </TableCell>
                        {isCreator && (
                          <TableCell>
                            {status.canPayout && (
                              <Button
                                size="sm"
                                onClick={() => processPayoutMutation.mutate(cycle)}
                                disabled={processPayoutMutation.isPending}
                              >
                                <Send className="h-4 w-4 mr-1" />
                                Process Payout
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}