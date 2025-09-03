import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  Shield, 
  AlertTriangle, 
  Ban, 
  MoreVertical,
  Clock,
  DollarSign,
  Shuffle,
  HandCoins,
  Home
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ReportUserDialog } from './ReportUserDialog';
import { PaymentScheduleDialog } from './PaymentScheduleDialog';
import { ContributionsDialog } from './ContributionsDialog';
import { PayoutOrderDialog } from './PayoutOrderDialog';
import { PayoutDialog } from './PayoutDialog';

interface GroupChatSidebarProps {
  groupId: string;
  isCreator: boolean;
}

export function GroupChatSidebar({ groupId, isCreator }: GroupChatSidebarProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [paymentScheduleOpen, setPaymentScheduleOpen] = useState(false);
  const [contributionsOpen, setContributionsOpen] = useState(false);
  const [payoutOrderOpen, setPayoutOrderOpen] = useState(false);
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);

  const { data: groupMembers } = useQuery({
    queryKey: ['group-members', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          id,
          user_id,
          joined_at,
          payout_position,
          profiles (
            first_name,
            last_name,
            email,
            is_frozen
          )
        `)
        .eq('group_id', groupId)
        .order('joined_at');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!groupId
  });

  const { data: groupInfo } = useQuery({
    queryKey: ['group-info', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('thrift_groups')
        .select('name, current_participants, max_participants')
        .eq('id', groupId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!groupId
  });

  const freezeUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_frozen: true,
          frozen_at: new Date().toISOString(),
          frozen_reason: 'Reported by group admin'
        })
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "User Frozen",
        description: "User access has been suspended.",
      });
      queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to freeze user",
        variant: "destructive",
      });
    }
  });

  const unfreezeUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_frozen: false,
          frozen_at: null,
          frozen_reason: null
        })
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "User Unfrozen",
        description: "User access has been restored.",
      });
      queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unfreeze user",
        variant: "destructive",
      });
    }
  });

  const handleReportUser = (userId: string) => {
    setSelectedUserId(userId);
    setReportDialogOpen(true);
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`;
  };

  const getStatusColor = (member: any) => {
    if (member.profiles?.is_frozen) return 'bg-destructive text-destructive-foreground';
    if (member.user_id === user?.id) return 'bg-primary text-primary-foreground';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <>
      <Sidebar className="md:w-80 w-16 transition-all duration-300">
        <SidebarHeader className="border-b p-2 md:p-4">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="md:hidden" />
            <div className="flex-1 hidden md:block">
              <h3 className="font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                Group Members
              </h3>
              {groupInfo && (
                <p className="text-sm text-muted-foreground">
                  {groupInfo.current_participants}/{groupInfo.max_participants} members
                </p>
              )}
            </div>
            <div className="md:hidden flex items-center justify-center w-full">
              <Users className="h-5 w-5" />
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          {/* Home Button */}
          <SidebarGroup>
            <SidebarGroupContent>
              <div className="p-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-center md:justify-start"
                  onClick={() => navigate('/dashboard')}
                  title="Go to Dashboard"
                >
                  <Home className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Dashboard</span>
                </Button>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel className="hidden md:block">
              Active Members
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <ScrollArea className="flex-1">
                <div className="space-y-2 p-2">
                  {groupMembers?.map((member: any) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                    >
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className={getStatusColor(member)}>
                          {getInitials(member.profiles?.first_name, member.profiles?.last_name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0 hidden md:block">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">
                            {member.profiles?.first_name} {member.profiles?.last_name}
                          </p>
                          {member.user_id === user?.id && (
                            <Badge variant="outline" className="text-xs">You</Badge>
                          )}
                          {member.profiles?.is_frozen && (
                            <Badge variant="destructive" className="text-xs">
                              <Ban className="h-3 w-3 mr-1" />
                              Frozen
                            </Badge>
                          )}
                        </div>
                        
                        {isCreator && (
                          <div className="flex items-center gap-1 mt-1">
                            <p className="text-xs text-muted-foreground truncate">
                              {member.profiles?.email}
                            </p>
                            
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                  <MoreVertical className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleReportUser(member.user_id)}
                                  className="text-yellow-600"
                                >
                                  <AlertTriangle className="h-4 w-4 mr-2" />
                                  Report User
                                </DropdownMenuItem>
                                
                                {member.profiles?.is_frozen ? (
                                  <DropdownMenuItem
                                    onClick={() => unfreezeUserMutation.mutate(member.user_id)}
                                    className="text-green-600"
                                  >
                                    <Shield className="h-4 w-4 mr-2" />
                                    Unfreeze User
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => freezeUserMutation.mutate(member.user_id)}
                                    className="text-red-600"
                                  >
                                    <Ban className="h-4 w-4 mr-2" />
                                    Freeze User
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </SidebarGroupContent>
          </SidebarGroup>

          {isCreator && (
            <SidebarGroup>
              <SidebarGroupLabel className="hidden md:block">Admin Actions</SidebarGroupLabel>
              <SidebarGroupContent>
                <div className="p-2 space-y-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-center md:justify-start"
                    onClick={() => setContributionsOpen(true)}
                    title="View Contributions"
                  >
                    <DollarSign className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">View Contributions</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-center md:justify-start"
                    onClick={() => setPaymentScheduleOpen(true)}
                    title="Payment Schedule"
                  >
                    <Clock className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">Payment Schedule</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-center md:justify-start"
                    onClick={() => setPayoutOrderOpen(true)}
                    title="Payout Order"
                  >
                    <Shuffle className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">Payout Order</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-center md:justify-start"
                    onClick={() => setPayoutDialogOpen(true)}
                    title="Process Payouts"
                  >
                    <HandCoins className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">Process Payouts</span>
                  </Button>
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>
      </Sidebar>

      <ReportUserDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        groupId={groupId}
        userId={selectedUserId}
      />
      
      <PaymentScheduleDialog
        open={paymentScheduleOpen}
        onOpenChange={setPaymentScheduleOpen}
        groupId={groupId}
        isCreator={isCreator}
      />
      
      <ContributionsDialog
        open={contributionsOpen}
        onOpenChange={setContributionsOpen}
        groupId={groupId}
        isCreator={isCreator}
      />
      
      <PayoutOrderDialog
        open={payoutOrderOpen}
        onOpenChange={setPayoutOrderOpen}
        groupId={groupId}
        isCreator={isCreator}
      />
      
      <PayoutDialog
        open={payoutDialogOpen}
        onOpenChange={setPayoutDialogOpen}
        groupId={groupId}
        isCreator={isCreator}
      />
    </>
  );
}