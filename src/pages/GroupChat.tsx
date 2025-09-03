import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Send, ArrowLeft, Users, Shield } from 'lucide-react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { GroupChatSidebar } from '@/components/GroupChatSidebar';

const GroupChatPage = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if user is group member or creator
  const { data: membershipData } = useQuery({
    queryKey: ['group-membership', groupId, user?.id],
    queryFn: async () => {
      if (!groupId || !user?.id) return null;
      
      // Check if user is group creator
      const { data: group } = await supabase
        .from('thrift_groups')
        .select('creator_id, name, description')
        .eq('id', groupId)
        .single();
      
      if (group?.creator_id === user.id) {
        return { isCreator: true, isMember: true, group };
      }
      
      // Check if user is group member
      const { data: membership } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .single();
      
      return { 
        isCreator: false, 
        isMember: !!membership, 
        group 
      };
    },
    enabled: !!groupId && !!user?.id
  });

  // Redirect if not authorized
  useEffect(() => {
    if (membershipData && !membershipData.isMember) {
      toast({
        title: "Access Denied",
        description: "You must be a member of this group to access the chat.",
        variant: "destructive",
      });
      navigate('/groups');
    }
  }, [membershipData, navigate, toast]);

  // Real-time messages
  const { data: messages, isLoading } = useQuery({
    queryKey: ['group-messages', groupId],
    queryFn: async () => {
      if (!groupId) return [];
      const { data, error } = await supabase
        .from('group_messages')
        .select(`
          id,
          message,
          created_at,
          user_id,
          profiles (
            first_name,
            last_name
          )
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!groupId && membershipData?.isMember
  });

  // Set up real-time subscription
  useEffect(() => {
    if (!groupId || !membershipData?.isMember) return;

    const channel = supabase
      .channel('group-messages-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${groupId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['group-messages', groupId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, membershipData?.isMember, queryClient]);

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!user?.id || !groupId) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('group_messages')
        .insert({
          group_id: groupId,
          user_id: user.id,
          message: message.trim(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      setNewMessage('');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    }
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate(newMessage);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!membershipData?.isMember) {
    return null; // Will redirect
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
          <div className="h-4 bg-muted rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <GroupChatSidebar 
          groupId={groupId!} 
          isCreator={membershipData.isCreator} 
        />
        
        <main className="flex-1 flex flex-col">
          {/* Header */}
          <Card className="rounded-none border-x-0 border-t-0">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => navigate('/groups')}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    {membershipData.isCreator ? (
                      <Shield className="h-5 w-5 text-primary" />
                    ) : (
                      <Users className="h-5 w-5 text-muted-foreground" />
                    )}
                    {membershipData.group?.name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {membershipData.group?.description}
                  </p>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col p-4">
            <ScrollArea className="flex-1 pr-4 mb-4">
              <div className="space-y-4">
                {messages && messages.length > 0 ? (
                  messages.map((message: any) => (
                    <div key={message.id} className={`flex ${message.user_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.user_id === user?.id 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted'
                      }`}>
                        {message.user_id !== user?.id && (
                          <div className="text-xs font-medium mb-1">
                            {message.profiles?.first_name} {message.profiles?.last_name}
                          </div>
                        )}
                        <div className="text-sm">{message.message}</div>
                        <div className={`text-xs mt-1 ${
                          message.user_id === user?.id 
                            ? 'text-primary-foreground/70' 
                            : 'text-muted-foreground'
                        }`}>
                          {new Date(message.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Send className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
                    <p className="text-muted-foreground text-sm">
                      Be the first to start the conversation!
                    </p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <Card>
              <CardContent className="p-4">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={sendMessageMutation.isPending}
                    className="flex-1"
                  />
                  <Button 
                    type="submit" 
                    size="icon"
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default GroupChatPage;