import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Wallet, 
  Users, 
  TrendingUp, 
  AlertCircle, 
  Plus,
  Calendar,
  CreditCard,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@/lib/utils';

export default function Dashboard() {
  const { user } = useAuth();

  // Fetch user's wallet
  const { data: wallet } = useQuery({
    queryKey: ['wallet', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch user's verification status
  const { data: verification } = useQuery({
    queryKey: ['verification', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('verification')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch user's thrift groups
  const { data: groups } = useQuery({
    queryKey: ['userGroups', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          *,
          thrift_groups (
            id,
            name,
            contribution_amount,
            frequency,
            status,
            max_participants,
            current_participants,
            start_date
          )
        `)
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch pending contributions
  const { data: pendingContributions } = useQuery({
    queryKey: ['pendingContributions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('contributions')
        .select(`
          *,
          thrift_groups (name)
        `)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('due_date', { ascending: true })
        .limit(5);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch recent transactions
  const { data: recentTransactions } = useQuery({
    queryKey: ['recentTransactions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const isVerified = verification?.verification_status === 'approved';
  const activeGroups = groups?.filter(g => g.thrift_groups?.status === 'active') || [];
  const totalContributions = activeGroups.reduce((sum, group) => 
    sum + (group.thrift_groups?.contribution_amount || 0), 0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with your thrift savings.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/groups">
              <Users className="mr-2 h-4 w-4" />
              Browse Groups
            </Link>
          </Button>
          {isVerified && (
            <Button asChild>
              <Link to="/groups/create">
                <Plus className="mr-2 h-4 w-4" />
                Create Group
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Verification Status Alert */}
      {!isVerified && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <AlertCircle className="h-8 w-8 text-warning" />
              <div className="flex-1">
                <h3 className="font-semibold text-warning-foreground">
                  Complete Your Verification
                </h3>
                <p className="text-sm text-muted-foreground">
                  You need to complete BVN and KYC verification to join groups and access all features.
                </p>
              </div>
              <Button asChild>
                <Link to="/verification">Complete Verification</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wallet Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(wallet?.balance || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Available for contributions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Groups</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeGroups.length}</div>
            <p className="text-xs text-muted-foreground">
              Groups you're contributing to
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Contributions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalContributions)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total monthly commitment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verification Status</CardTitle>
            {isVerified ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : (
              <Clock className="h-4 w-4 text-warning" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge variant={isVerified ? "default" : "secondary"}>
                {verification?.verification_status || 'pending'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Account verification
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Active Groups */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              My Active Groups
            </CardTitle>
            <CardDescription>
              Groups you're currently participating in
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeGroups.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground">No active groups</p>
                <Button asChild className="mt-2" size="sm">
                  <Link to="/groups">Browse Groups</Link>
                </Button>
              </div>
            ) : (
              activeGroups.slice(0, 3).map((membership) => {
                const group = membership.thrift_groups;
                const progress = ((group?.current_participants || 0) / (group?.max_participants || 1)) * 100;
                
                return (
                  <div key={membership.id} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium">{group?.name}</h4>
                      <Badge variant="outline">
                        {formatCurrency(group?.contribution_amount || 0)}/{group?.frequency}
                      </Badge>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {group?.current_participants}/{group?.max_participants} members
                    </p>
                  </div>
                );
              })
            )}
            {activeGroups.length > 3 && (
              <Button asChild variant="ghost" size="sm" className="w-full">
                <Link to="/groups">View All Groups</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Pending Contributions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Contributions
            </CardTitle>
            <CardDescription>
              Payments due soon
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingContributions?.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground">No pending contributions</p>
              </div>
            ) : (
              pendingContributions?.slice(0, 3).map((contribution) => (
                <div key={contribution.id} className="flex justify-between items-center p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{contribution.thrift_groups?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Due: {new Date(contribution.due_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(contribution.amount)}</p>
                    <Badge variant="outline" className="text-xs">
                      Cycle {contribution.cycle_number}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Recent Transactions
            </CardTitle>
            <CardDescription>
              Your latest wallet activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentTransactions?.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground">No recent transactions</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTransactions?.slice(0, 5).map((transaction) => (
                  <div key={transaction.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        transaction.transaction_type === 'credit' 
                          ? 'bg-success/10 text-success' 
                          : 'bg-destructive/10 text-destructive'
                      }`}>
                        <CreditCard className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">{transaction.description || transaction.category}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(transaction.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${
                        transaction.transaction_type === 'credit' ? 'text-success' : 'text-destructive'
                      }`}>
                        {transaction.transaction_type === 'credit' ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Balance: {formatCurrency(transaction.balance_after)}
                      </p>
                    </div>
                  </div>
                ))}
                <Button asChild variant="ghost" size="sm" className="w-full">
                  <Link to="/transactions">View All Transactions</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}