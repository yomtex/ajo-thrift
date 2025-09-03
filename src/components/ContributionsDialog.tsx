import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, AlertTriangle, CheckCircle, Clock, Users } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ContributionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  isCreator: boolean;
}

export function ContributionsDialog({ 
  open, 
  onOpenChange, 
  groupId, 
  isCreator 
}: ContributionsDialogProps) {
  const [selectedCycle, setSelectedCycle] = useState<number>(1);

  const { data: contributions } = useQuery({
    queryKey: ['all-contributions', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contributions')
        .select(`
          *
        `)
        .eq('group_id', groupId)
        .order('cycle_number', { ascending: true });
      
      if (error) throw error;

      // Get user profiles separately
      if (!data || data.length === 0) return [];
      
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, is_frozen')
        .in('id', userIds);

      // Merge contributions with profiles
      return data.map(contribution => ({
        ...contribution,
        profiles: profiles?.find(p => p.id === contribution.user_id)
      }));
    },
    enabled: !!groupId && open
  });

  // Query to get user payment history across all groups for late payment analysis
  const { data: paymentHistory } = useQuery({
    queryKey: ['payment-history', groupId],
    queryFn: async () => {
      if (!isCreator) return [];
      
      // Get all members of this group
      const { data: members } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId);

      if (!members) return [];

      // Get contribution history for all members across all groups
      const { data: history, error } = await supabase
        .from('contributions')
        .select(`
          user_id,
          status,
          due_date,
          paid_date,
          group_id
        `)
        .in('user_id', members.map(m => m.user_id))
        .neq('group_id', groupId); // Exclude current group

      if (error) throw error;
      return history || [];
    },
    enabled: !!groupId && open && isCreator
  });

  const getStatusBadge = (status: string, dueDate: string, paidDate?: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    
    if (status === 'paid') {
      const paid = new Date(paidDate!);
      const wasLate = paid > due;
      return (
        <Badge className={wasLate ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}>
          <CheckCircle className="h-3 w-3 mr-1" />
          {wasLate ? 'Paid Late' : 'Paid On Time'}
        </Badge>
      );
    }
    
    if (now > due) {
      return (
        <Badge variant="destructive">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Late ({Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))} days)
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  };

  const getLatePaymentStats = (userId: string) => {
    const userHistory = paymentHistory?.filter(h => h.user_id === userId) || [];
    const totalPayments = userHistory.length;
    const latePayments = userHistory.filter(h => {
      if (h.status !== 'paid' || !h.paid_date) return false;
      return new Date(h.paid_date) > new Date(h.due_date);
    }).length;
    
    return { totalPayments, latePayments, lateRate: totalPayments > 0 ? (latePayments / totalPayments) * 100 : 0 };
  };

  const cycles = [...new Set(contributions?.map(c => c.cycle_number) || [])].sort();
  const currentCycleContributions = contributions?.filter(c => c.cycle_number === selectedCycle) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Group Contributions
          </DialogTitle>
          <DialogDescription>
            View detailed contribution status and payment history
          </DialogDescription>
        </DialogHeader>

        {contributions && contributions.length > 0 ? (
          <Tabs defaultValue="current" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="current">Current Cycle</TabsTrigger>
              <TabsTrigger value="history">Payment History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="current" className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">Select Cycle:</label>
                <div className="flex gap-2">
                  {cycles.map(cycle => (
                    <Button
                      key={cycle}
                      variant={selectedCycle === cycle ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCycle(cycle)}
                    >
                      Cycle {cycle}
                    </Button>
                  ))}
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    {isCreator && <TableHead>Late Payment History</TableHead>}
                    {isCreator && <TableHead>Account Status</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentCycleContributions.map((contribution) => {
                    const stats = isCreator ? getLatePaymentStats(contribution.user_id) : null;
                    return (
                      <TableRow key={contribution.id}>
                        <TableCell className="font-medium">
                          {contribution.profiles?.first_name} {contribution.profiles?.last_name}
                        </TableCell>
                        <TableCell>₦{contribution.amount}</TableCell>
                        <TableCell>{new Date(contribution.due_date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {getStatusBadge(contribution.status, contribution.due_date, contribution.paid_date)}
                        </TableCell>
                        {isCreator && (
                          <TableCell>
                            {stats && stats.totalPayments > 0 ? (
                              <div className="text-sm">
                                <span className={stats.lateRate > 50 ? "text-red-600 font-medium" : 
                                              stats.lateRate > 20 ? "text-yellow-600" : "text-green-600"}>
                                  {stats.latePayments}/{stats.totalPayments} late ({stats.lateRate.toFixed(0)}%)
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">No history</span>
                            )}
                          </TableCell>
                        )}
                        {isCreator && (
                          <TableCell>
                            {contribution.profiles?.is_frozen ? (
                              <Badge variant="destructive">Frozen</Badge>
                            ) : (
                              <Badge variant="outline">Active</Badge>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TabsContent>
            
            <TabsContent value="history" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Paid On Time</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    {contributions.filter(c => c.status === 'paid' && c.paid_date && new Date(c.paid_date) <= new Date(c.due_date)).length}
                  </p>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    <span className="font-medium">Paid Late</span>
                  </div>
                  <p className="text-2xl font-bold text-yellow-600">
                    {contributions.filter(c => c.status === 'paid' && c.paid_date && new Date(c.paid_date) > new Date(c.due_date)).length}
                  </p>
                </div>
                
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-red-600" />
                    <span className="font-medium">Outstanding</span>
                  </div>
                  <p className="text-2xl font-bold text-red-600">
                    {contributions.filter(c => c.status === 'pending' && new Date() > new Date(c.due_date)).length}
                  </p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cycle</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Paid Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contributions.map((contribution) => (
                    <TableRow key={contribution.id}>
                      <TableCell>Cycle {contribution.cycle_number}</TableCell>
                      <TableCell className="font-medium">
                        {contribution.profiles?.first_name} {contribution.profiles?.last_name}
                      </TableCell>
                      <TableCell>₦{contribution.amount}</TableCell>
                      <TableCell>{new Date(contribution.due_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {contribution.paid_date ? new Date(contribution.paid_date).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(contribution.status, contribution.due_date, contribution.paid_date)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-8">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Contributions Yet</h3>
            <p className="text-muted-foreground text-sm">
              Contributions will appear here once the group starts collecting payments.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}