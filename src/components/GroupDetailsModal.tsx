import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  DollarSign, 
  Calendar, 
  Clock, 
  MessageCircle,
  CheckCircle,
  XCircle,
  UserPlus
} from 'lucide-react';
import GroupChat from './GroupChat';

interface GroupDetailsModalProps {
  group: any;
  children: React.ReactNode;
  isMember?: boolean;
}

const GroupDetailsModal = ({ group, children, isMember }: GroupDetailsModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: groupMembers } = useQuery({
    queryKey: ['group-members', group.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_group_members_safe', { 
          group_id_param: group.id 
        });
      
      if (error) throw error;
      return data || [];
    },
    enabled: open
  });

  const { data: joinRequests } = useQuery({
    queryKey: ['join-requests', group.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_join_requests')
        .select(`
          id,
          user_id,
          message,
          status,
          requested_at,
          profiles (
            first_name,
            last_name
          )
        `)
        .eq('group_id', group.id)
        .eq('status', 'pending');
      
      if (error) throw error;
      return data || [];
    },
    enabled: open && user?.id === group.creator_id
  });

  const approveJoinRequest = useMutation({
    mutationFn: async ({ requestId, userId }: { requestId: string; userId: string }) => {
      // Update join request status
      const { error: updateError } = await supabase
        .from('group_join_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Add user to group members
      const { error: insertError } = await supabase
        .from('group_members')
        .insert({
          user_id: userId,
          group_id: group.id
        });

      if (insertError) throw insertError;

      // Update group participant count
      const { error: groupError } = await supabase
        .from('thrift_groups')
        .update({
          current_participants: (group.current_participants || 0) + 1
        })
        .eq('id', group.id);

      if (groupError) throw groupError;
    },
    onSuccess: () => {
      toast({
        title: "Request Approved",
        description: "Member has been added to the group successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['join-requests', group.id] });
      queryClient.invalidateQueries({ queryKey: ['group-members', group.id] });
      queryClient.invalidateQueries({ queryKey: ['my-groups'] });
      queryClient.invalidateQueries({ queryKey: ['available-groups'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve join request",
        variant: "destructive",
      });
    }
  });

  const rejectJoinRequest = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('group_join_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id
        })
        .eq('id', requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Request Rejected",
        description: "Join request has been rejected.",
      });
      queryClient.invalidateQueries({ queryKey: ['join-requests', group.id] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject join request",
        variant: "destructive",
      });
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-success text-success-foreground';
      case 'completed':
        return 'bg-muted text-muted-foreground';
      case 'paused':
        return 'bg-warning text-warning-foreground';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  const isGroupCreator = user?.id === group.creator_id;
  const canViewChat = isMember || isGroupCreator;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 border-b">
          <DialogTitle className="text-xl sm:text-2xl">{group.name}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-6">
          {/* Group Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Group Overview
                <Badge className={getStatusColor(group.status)}>
                  {group.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {group.description && (
                <p className="text-muted-foreground">{group.description}</p>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{formatCurrency(group.contribution_amount)}</div>
                    <div className="text-sm text-muted-foreground">per {group.frequency}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">
                      {group.current_participants || 0}/{group.max_participants}
                    </div>
                    <div className="text-sm text-muted-foreground">members</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{group.frequency}</div>
                    <div className="text-sm text-muted-foreground">frequency</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">
                      {new Date(group.created_at).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-muted-foreground">created</div>
                  </div>
                </div>
              </div>
              
              {group.target_amount && (
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Target Amount:</span>
                    <span className="font-medium">{formatCurrency(group.target_amount)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="members" className="space-y-4">
            <TabsList>
              <TabsTrigger value="members">Members</TabsTrigger>
              {isGroupCreator && joinRequests && joinRequests.length > 0 && (
                <TabsTrigger value="requests" className="relative">
                  Join Requests
                  <Badge className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                    {joinRequests.length}
                  </Badge>
                </TabsTrigger>
              )}
              {canViewChat && (
                <TabsTrigger value="chat">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Chat
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="members" className="space-y-4 max-h-[50vh] overflow-y-auto">
              <div className="grid gap-4">
                {groupMembers?.map((member: any) => (
                  <Card key={member.id}>
                    <CardContent className="flex items-center justify-between p-4">
                       <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          {member.first_name?.[0]}{member.last_name?.[0]}
                        </div>
                        <div>
                          <div className="font-medium">
                            {member.first_name} {member.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Member ID: {member.user_id.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          Joined {new Date(member.joined_at).toLocaleDateString()}
                        </div>
                        {member.payout_position && (
                          <div className="text-sm font-medium">
                            Position: {member.payout_position}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {isGroupCreator && (
              <TabsContent value="requests" className="space-y-4 max-h-[50vh] overflow-y-auto">
                {joinRequests && joinRequests.length > 0 ? (
                  <div className="grid gap-4">
                    {joinRequests.map((request: any) => (
                      <Card key={request.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <UserPlus className="h-5 w-5" />
                              </div>
                               <div className="space-y-1">
                                <div className="font-medium">
                                  {request.profiles?.first_name} {request.profiles?.last_name}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  User ID: {request.user_id.slice(0, 8)}...
                                </div>
                                {request.message && (
                                  <div className="text-sm bg-muted p-2 rounded">
                                    {request.message}
                                  </div>
                                )}
                                <div className="text-xs text-muted-foreground">
                                  Requested {new Date(request.requested_at).toLocaleString()}
                                </div>
                               </div>
                             </div>
                             <div className="flex gap-2">
                               <Button
                                 size="sm"
                                 variant="outline"
                                 onClick={() => rejectJoinRequest.mutate(request.id)}
                                 disabled={rejectJoinRequest.isPending}
                               >
                                 <XCircle className="h-4 w-4 mr-1" />
                                 Reject
                               </Button>
                               <Button
                                 size="sm"
                                 onClick={() => approveJoinRequest.mutate({
                                   requestId: request.id,
                                   userId: request.user_id
                                 })}
                                 disabled={approveJoinRequest.isPending}
                               >
                                 <CheckCircle className="h-4 w-4 mr-1" />
                                 Approve
                               </Button>
                             </div>
                           </div>
                         </CardContent>
                       </Card>
                     ))}
                   </div>
                ) : (
                  <Card className="text-center py-8">
                    <CardContent>
                      <UserPlus className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No pending requests</h3>
                      <p className="text-muted-foreground">
                        All join requests have been processed.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            )}

            {canViewChat && (
              <TabsContent value="chat">
                <GroupChat groupId={group.id} />
              </TabsContent>
            )}
          </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GroupDetailsModal;