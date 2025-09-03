import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, Users, Calendar, DollarSign, MessageCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import GroupDetailsModal from '@/components/GroupDetailsModal';
import JoinGroupDialog from '@/components/JoinGroupDialog';

const Groups = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: myGroups, isLoading: myGroupsLoading } = useQuery({
    queryKey: ['my-groups', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          id,
          joined_at,
          payout_position,
          thrift_groups (
            id,
            name,
            description,
            contribution_amount,
            frequency,
            status,
            max_participants,
            current_participants,
            created_at
          )
        `)
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  const { data: availableGroups, isLoading: availableGroupsLoading } = useQuery({
    queryKey: ['available-groups', searchTerm],
    queryFn: async () => {
      if (!user?.id) return [];
      let query = supabase
        .from('thrift_groups')
        .select(`
          id,
          name,
          description,
          contribution_amount,
          frequency,
          status,
          max_participants,
          current_participants,
          created_at
        `)
        .eq('status', 'recruiting')
        .neq('creator_id', user.id);

      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      const { data, error } = await query.limit(20);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
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

  const GroupCard = ({ group, isMember = false }: { group: any; isMember?: boolean }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{group.name}</CardTitle>
            <CardDescription className="mt-1">
              {group.description || 'No description provided'}
            </CardDescription>
          </div>
          <Badge className={getStatusColor(group.status)}>
            {group.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-medium">{formatCurrency(group.contribution_amount)}</div>
              <div className="text-muted-foreground">per {group.frequency}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-medium">
                {group.current_participants || 0}/{group.max_participants}
              </div>
              <div className="text-muted-foreground">members</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>Frequency: {group.frequency}</span>
        </div>

        <div className="flex gap-2">
          {isMember ? (
            <>
              <GroupDetailsModal group={group} isMember={isMember}>
                <Button variant="outline" className="flex-1">
                  View Details
                </Button>
              </GroupDetailsModal>
              <GroupDetailsModal group={group} isMember={isMember}>
                <Button variant="outline" size="icon">
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </GroupDetailsModal>
            </>
          ) : (
            <>
              <GroupDetailsModal group={group} isMember={isMember}>
                <Button variant="outline" className="flex-1">
                  View Details
                </Button>
              </GroupDetailsModal>
              <JoinGroupDialog group={group}>
                <Button className="flex-1">
                  Join Group
                </Button>
              </JoinGroupDialog>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Thrift Groups</h1>
          <p className="text-muted-foreground">
            Join or create savings groups with your community
          </p>
        </div>
        <Button onClick={() => navigate('/groups/create')}>
          <Plus className="mr-2 h-4 w-4" />
          Create Group
        </Button>
      </div>

      <Tabs defaultValue="my-groups" className="space-y-6">
        <TabsList>
          <TabsTrigger value="my-groups">My Groups</TabsTrigger>
          <TabsTrigger value="discover">Discover Groups</TabsTrigger>
        </TabsList>

        <TabsContent value="my-groups" className="space-y-6">
          {myGroupsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-64 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {myGroups && myGroups.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {myGroups.map((membership: any) => (
                    <GroupCard 
                      key={membership.id} 
                      group={membership.thrift_groups} 
                      isMember={true}
                    />
                  ))}
                </div>
              ) : (
                <Card className="text-center py-12">
                  <CardContent>
                    <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No groups yet</h3>
                    <p className="text-muted-foreground mb-4">
                      You haven't joined any thrift groups. Start by discovering or creating one!
                    </p>
                    <div className="flex gap-2 justify-center">
                      <Button variant="outline" onClick={() => navigate('/groups/create')}>Create Group</Button>
                      <Button onClick={() => navigate('/groups/create')}>Create Group</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="discover" className="space-y-6">
          <div className="flex items-center space-x-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search groups by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>

          {availableGroupsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-64 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {availableGroups && availableGroups.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {availableGroups.map((group: any) => (
                    <GroupCard key={group.id} group={group} />
                  ))}
                </div>
              ) : (
                <Card className="text-center py-12">
                  <CardContent>
                    <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      {searchTerm ? 'No groups found' : 'No available groups'}
                    </h3>
                    <p className="text-muted-foreground">
                      {searchTerm 
                        ? 'Try adjusting your search terms or create a new group.'
                        : 'Be the first to create a thrift group in your community!'
                      }
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Groups;