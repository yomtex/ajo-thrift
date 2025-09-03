import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wallet as WalletIcon, Plus, Minus, Eye, EyeOff, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';
import { usePaystackPayment } from 'react-paystack';

const Wallet = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showBalance, setShowBalance] = useState(true);
  const [fundAmount, setFundAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const { data: wallet, isLoading: walletLoading } = useQuery({
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
    enabled: !!user?.id
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['wallet-transactions', user?.id],
    queryFn: async () => {
      if (!user?.id || !wallet) return [];
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!wallet
  });

  const fundWalletMutation = useMutation({
    mutationFn: async (amount: number) => {
      if (!user?.id || !wallet) throw new Error('User or wallet not found');
      
      const newBalance = wallet.balance + amount;
      
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          wallet_id: wallet.id,
          user_id: user.id,
          transaction_type: 'credit',
          category: 'wallet_topup',
          amount,
          balance_after: newBalance,
          description: 'Wallet funding via Paystack'
        })
        .select()
        .single();

      if (error) throw error;
      
      // Update wallet balance
      await supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('id', wallet.id);
        
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Wallet Funded",
        description: "Your wallet has been funded successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
      setFundAmount('');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to fund wallet",
        variant: "destructive",
      });
    }
  });

  const withdrawMutation = useMutation({
    mutationFn: async (amount: number) => {
      if (!user?.id || !wallet) throw new Error('User or wallet not found');
      if (wallet.balance < amount) {
        throw new Error('Insufficient balance');
      }
      
      const newBalance = wallet.balance - amount;
      
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          wallet_id: wallet.id,
          user_id: user.id,
          transaction_type: 'debit',
          category: 'withdrawal',
          amount,
          balance_after: newBalance,
          description: 'Wallet withdrawal'
        })
        .select()
        .single();

      if (error) throw error;
      
      // Update wallet balance
      await supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('id', wallet.id);
        
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Withdrawal Successful",
        description: "Your withdrawal request has been processed.",
      });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
      setWithdrawAmount('');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process withdrawal",
        variant: "destructive",
      });
    }
  });

  // Paystack configuration
  const paystackConfig = {
    reference: `wallet_${Date.now()}`,
    email: user?.email || '',
    amount: Math.round(parseFloat(fundAmount || '0') * 100), // Convert to kobo
    publicKey: 'pk_test_aa9503c68e6db9cc9f49e0b8e4c96d0f27cf7e76', // Test public key
  };

  const initializePayment = usePaystackPayment(paystackConfig);

  const handleFund = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(fundAmount);
    
    // Set reasonable limits for testing: ₦100 to ₦50,000
    if (amount < 100 || amount > 50000) {
      toast({
        title: "Invalid Amount",
        description: "Please enter an amount between ₦100 and ₦50,000 for testing",
        variant: "destructive",
      });
      return;
    }

    initializePayment({
      onSuccess: (reference) => {
        console.log('Payment successful:', reference);
        fundWalletMutation.mutate(amount);
      },
      onClose: () => {
        toast({
          title: "Payment Cancelled",
          description: "Payment was cancelled by user",
          variant: "destructive",
        });
      },
    });
  };

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);
    if (amount > 0 && wallet && amount <= wallet.balance) {
      withdrawMutation.mutate(amount);
    } else {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount within your balance",
        variant: "destructive",
      });
    }
  };

  const getTransactionIcon = (type: string) => {
    return type === 'credit' ? (
      <ArrowDownRight className="h-4 w-4 text-success" />
    ) : (
      <ArrowUpRight className="h-4 w-4 text-destructive" />
    );
  };

  if (walletLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">My Wallet</h1>
        <p className="text-muted-foreground">
          Manage your funds and view transaction history
        </p>
      </div>

      <div className="grid gap-6">
        {/* Wallet Balance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WalletIcon className="h-5 w-5" />
              Wallet Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold">
                    {showBalance ? formatCurrency(wallet?.balance || 0) : '••••••'}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowBalance(!showBalance)}
                  >
                    {showBalance ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">Available balance</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fund & Withdraw */}
        <Tabs defaultValue="fund" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="fund">Fund Wallet</TabsTrigger>
            <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
          </TabsList>

          <TabsContent value="fund">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Fund Wallet
                </CardTitle>
                <CardDescription>
                  Add money to your wallet to participate in thrift groups
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleFund} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fund-amount">Amount (NGN)</Label>
                    <Input
                      id="fund-amount"
                      type="number"
                      placeholder="Enter amount (₦100 - ₦50,000)"
                      value={fundAmount}
                      onChange={(e) => setFundAmount(e.target.value)}
                      min="100"
                      max="50000"
                      step="1"
                    />
                    <p className="text-xs text-muted-foreground">
                      Testing limits: ₦100 - ₦50,000
                    </p>
                  </div>

                  <Alert>
                    <AlertDescription>
                      <strong>Paystack Test Mode:</strong> Using test keys for secure testing. No real money will be charged.
                    </AlertDescription>
                  </Alert>

                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={!fundAmount || fundWalletMutation.isPending || parseFloat(fundAmount || '0') < 100 || parseFloat(fundAmount || '0') > 50000}
                  >
                    {fundWalletMutation.isPending ? 'Processing...' : 'Pay with Paystack'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="withdraw">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Minus className="h-5 w-5" />
                  Withdraw Funds
                </CardTitle>
                <CardDescription>
                  Withdraw money from your wallet to your bank account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleWithdraw} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="withdraw-amount">Amount (NGN)</Label>
                    <Input
                      id="withdraw-amount"
                      type="number"
                      placeholder="Enter amount"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      min="1"
                      max={wallet?.balance || 0}
                      step="0.01"
                    />
                    <p className="text-xs text-muted-foreground">
                      Available: {formatCurrency(wallet?.balance || 0)}
                    </p>
                  </div>

                  <Alert>
                    <AlertDescription>
                      <strong>Demo Mode:</strong> Withdrawals would normally be processed to your linked bank account.
                    </AlertDescription>
                  </Alert>

                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={!withdrawAmount || withdrawMutation.isPending}
                  >
                    {withdrawMutation.isPending ? 'Processing...' : 'Withdraw Funds'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Your latest wallet transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : transactions && transactions.length > 0 ? (
              <div className="space-y-2">
                {transactions.map((transaction: any) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      {getTransactionIcon(transaction.transaction_type)}
                      <div>
                        <div className="font-medium">{transaction.description}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(transaction.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className={`font-medium ${
                      transaction.transaction_type === 'credit' ? 'text-success' : 'text-destructive'
                    }`}>
                      {transaction.transaction_type === 'credit' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <WalletIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No transactions yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Wallet;