import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, ArrowUpRight, ArrowDownRight, RefreshCw, Filter } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';

const Transactions = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['all-transactions', user?.id, searchTerm, filterType, filterStatus],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // First get user's wallet
      const { data: wallet } = await supabase
        .from('wallets')
        .select('id')
        .eq('user_id', user.id)
        .single();
        
      if (!wallet) return [];
      
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false });

      if (filterType !== 'all') {
        query = query.eq('transaction_type', filterType as 'credit' | 'debit');
      }

      if (filterStatus !== 'all') {
        query = query.eq('category', filterStatus as 'contribution' | 'payout' | 'wallet_topup' | 'withdrawal');
      }

      if (searchTerm) {
        query = query.ilike('description', `%${searchTerm}%`);
      }

      const { data, error } = await query.limit(100);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const getTransactionIcon = (type: string) => {
    return type === 'credit' ? (
      <div className="p-2 rounded-full bg-success/10">
        <ArrowDownRight className="h-4 w-4 text-success" />
      </div>
    ) : (
      <div className="p-2 rounded-full bg-destructive/10">
        <ArrowUpRight className="h-4 w-4 text-destructive" />
      </div>
    );
  };

  const getStatusBadge = (category: string) => {
    const statusConfig = {
      wallet_topup: { label: 'Wallet Top-up', variant: 'default' as const },
      withdrawal: { label: 'Withdrawal', variant: 'secondary' as const },
      contribution: { label: 'Contribution', variant: 'outline' as const },
      payout: { label: 'Payout', variant: 'default' as const }
    };

    const config = statusConfig[category as keyof typeof statusConfig] || statusConfig.wallet_topup;
    
    return (
      <Badge variant={config.variant}>
        {config.label}
      </Badge>
    );
  };

  const getTypeLabel = (type: string) => {
    return type === 'credit' ? 'Credit' : 'Debit';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const groupedTransactions = transactions?.reduce((acc: any, transaction: any) => {
    const date = new Date(transaction.created_at).toDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(transaction);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Transaction History</h1>
        <p className="text-muted-foreground">
          View all your wallet and group transactions
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="credit">Credit</SelectItem>
                <SelectItem value="debit">Debit</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="wallet_topup">Wallet Top-up</SelectItem>
                <SelectItem value="withdrawal">Withdrawal</SelectItem>
                <SelectItem value="contribution">Contribution</SelectItem>
                <SelectItem value="payout">Payout</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transactions */}
      <div className="space-y-6">
        {transactions && transactions.length > 0 ? (
          <>
            {Object.entries(groupedTransactions || {}).map(([date, dayTransactions]: [string, any]) => (
              <Card key={date}>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">
                    {new Date(date).toLocaleDateString('en-NG', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {dayTransactions.map((transaction: any) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        {getTransactionIcon(transaction.transaction_type)}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{transaction.description}</span>
                            <Badge variant="outline" className="text-xs">
                              {getTypeLabel(transaction.transaction_type)}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatDate(transaction.created_at)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {getStatusBadge(transaction.category)}
                        <div className={`text-right font-medium ${
                          transaction.transaction_type === 'credit' ? 'text-success' : 'text-destructive'
                        }`}>
                          {transaction.transaction_type === 'credit' ? '+' : '-'}
                          {formatCurrency(transaction.amount)}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <RefreshCw className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchTerm || filterType !== 'all' || filterStatus !== 'all'
                  ? 'No matching transactions'
                  : 'No transactions yet'
                }
              </h3>
              <p className="text-muted-foreground">
                {searchTerm || filterType !== 'all' || filterStatus !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Your transaction history will appear here once you start using your wallet.'
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Transactions;