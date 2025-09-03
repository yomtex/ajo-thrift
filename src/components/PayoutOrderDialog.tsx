import { useState, useEffect } from 'react';
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
import { Shuffle, AlertTriangle, CheckCircle, ArrowUp, ArrowDown } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

interface PayoutOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  isCreator: boolean;
}

interface Member {
  id: string;
  user_id: string;
  payout_position: number | null;
  profiles: {
    first_name: string;
    last_name: string;
    email: string;
  };
  latePaymentRate: number;
  totalGroups: number;
}

export function PayoutOrderDialog({ 
  open, 
  onOpenChange, 
  groupId, 
  isCreator 
}: PayoutOrderDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [members, setMembers] = useState<Member[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: groupData } = useQuery({
    queryKey: ['group-payout-order', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('thrift_groups')
        .select(`
          *,
          group_members (
            id,
            user_id,
            payout_position,
            profiles (
              first_name,
              last_name,
              email
            )
          )
        `)
        .eq('id', groupId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!groupId && open
  });

  // Analyze payment history to determine late payment rates
  const analyzePaymentHistory = async () => {
    if (!groupData?.group_members) return;
    
    setIsAnalyzing(true);
    
    try {
      const memberIds = groupData.group_members.map(m => m.user_id);
      
      // Get payment history for all members across all groups
      const { data: paymentHistory, error } = await supabase
        .from('contributions')
        .select(`
          user_id,
          status,
          due_date,
          paid_date,
          group_id
        `)
        .in('user_id', memberIds);

      if (error) throw error;

      // Calculate late payment statistics for each member
        const membersWithStats = groupData.group_members.map((member: any) => {
        const memberPayments = paymentHistory?.filter(p => p.user_id === member.user_id) || [];
        const totalPayments = memberPayments.length;
        const latePayments = memberPayments.filter(p => {
          if (p.status !== 'paid' || !p.paid_date) return false;
          return new Date(p.paid_date) > new Date(p.due_date);
        }).length;
        
        const latePaymentRate = totalPayments > 0 ? (latePayments / totalPayments) * 100 : 0;
        const uniqueGroups = [...new Set(memberPayments.map(p => p.group_id))].length;
        
        return {
          ...member,
          latePaymentRate,
          totalGroups: uniqueGroups
        };
      });

      // Sort members by late payment rate (ascending) - reliable payers first
      const sortedMembers = membersWithStats.sort((a, b) => {
        // If one member has no history, put them in the middle
        if (a.totalGroups === 0 && b.totalGroups > 0) return 1;
        if (b.totalGroups === 0 && a.totalGroups > 0) return -1;
        if (a.totalGroups === 0 && b.totalGroups === 0) return 0;
        
        // Sort by late payment rate
        return a.latePaymentRate - b.latePaymentRate;
      });

      // Assign payout positions
      const membersWithPositions = sortedMembers.map((member, index) => ({
        ...member,
        payout_position: member.payout_position || index + 1
      }));

      setMembers(membersWithPositions);
    } catch (error) {
      console.error('Error analyzing payment history:', error);
      toast({
        title: "Analysis Error",
        description: "Could not analyze payment history",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (open && groupData?.group_members) {
      analyzePaymentHistory();
    }
  }, [open, groupData]);

  const updatePayoutOrderMutation = useMutation({
    mutationFn: async (newOrder: Member[]) => {
      for (const member of newOrder) {
        const position = newOrder.indexOf(member) + 1;
        const { error } = await supabase
          .from('group_members')
          .update({ payout_position: position })
          .eq('id', member.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Payout Order Updated",
        description: "The payout order has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['group-payout-order', groupId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update payout order",
        variant: "destructive",
      });
    }
  });

  const finalizeOrderMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('thrift_groups')
        .update({ payout_order_finalized: true })
        .eq('id', groupId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Payout Order Finalized",
        description: "The payout order is now locked and contributions can begin.",
      });
      queryClient.invalidateQueries({ queryKey: ['group-payout-order', groupId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to finalize payout order",
        variant: "destructive",
      });
    }
  });

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(members);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setMembers(items);
  };

  const getRiskBadge = (latePaymentRate: number, totalGroups: number) => {
    if (totalGroups === 0) {
      return <Badge variant="outline">New Member</Badge>;
    }
    
    if (latePaymentRate >= 50) {
      return <Badge variant="destructive">High Risk</Badge>;
    } else if (latePaymentRate >= 20) {
      return <Badge className="bg-yellow-100 text-yellow-800">Medium Risk</Badge>;
    } else {
      return <Badge className="bg-green-100 text-green-800">Low Risk</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shuffle className="h-5 w-5" />
            Payout Order Management
          </DialogTitle>
          <DialogDescription>
            Arrange the payout order based on payment reliability. Members with better payment history get priority.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {isAnalyzing ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Analyzing payment history...</p>
            </div>
          ) : (
            <>
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Smart Ordering Applied</h3>
                <p className="text-sm text-muted-foreground">
                  Members are automatically ordered by payment reliability. Reliable payers receive payouts first, 
                  while members with late payment history are placed later in the queue.
                </p>
              </div>

              {isCreator && !groupData?.payout_order_finalized && (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="members">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                        {members.map((member, index) => (
                          <Draggable key={member.id} draggableId={member.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`flex items-center justify-between p-3 border rounded-lg ${
                                  snapshot.isDragging ? 'shadow-lg' : 'hover:bg-muted/50'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                                    {index + 1}
                                  </div>
                                  <div>
                                    <p className="font-medium">
                                      {member.profiles.first_name} {member.profiles.last_name}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {member.totalGroups > 0 
                                        ? `${member.latePaymentRate.toFixed(0)}% late rate (${member.totalGroups} groups)`
                                        : 'No payment history'
                                      }
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {getRiskBadge(member.latePaymentRate, member.totalGroups)}
                                  <div className="text-muted-foreground">
                                    ⋮⋮
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}

              {groupData?.payout_order_finalized && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-600 mb-4">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Payout Order Finalized</span>
                  </div>
                  {members.map((member, index) => (
                    <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">
                            {member.profiles.first_name} {member.profiles.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Payout in cycle {index + 1}
                          </p>
                        </div>
                      </div>
                      {getRiskBadge(member.latePaymentRate, member.totalGroups)}
                    </div>
                  ))}
                </div>
              )}

              {isCreator && (
                <div className="flex gap-2">
                  {!groupData?.payout_order_finalized ? (
                    <>
                      <Button 
                        onClick={() => updatePayoutOrderMutation.mutate(members)}
                        disabled={updatePayoutOrderMutation.isPending}
                        className="flex-1"
                      >
                        Save Order
                      </Button>
                      <Button 
                        onClick={() => finalizeOrderMutation.mutate()}
                        disabled={finalizeOrderMutation.isPending}
                        variant="destructive"
                      >
                        Finalize Order
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center w-full">
                      Payout order is finalized and cannot be changed.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}