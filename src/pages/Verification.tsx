import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Upload, Shield } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

const Verification = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [bvn, setBvn] = useState('');

  const { data: verification, isLoading } = useQuery({
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
    enabled: !!user?.id
  });

  const verifyBvnMutation = useMutation({
    mutationFn: async (bvnNumber: string) => {
      if (!user?.id) throw new Error('User not found');
      
      const { data, error } = await supabase
        .from('verification')
        .update({ 
          bvn: bvnNumber,
          verification_status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "BVN Submitted",
        description: "Your BVN has been submitted for verification.",
      });
      queryClient.invalidateQueries({ queryKey: ['verification'] });
      setBvn('');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit BVN",
        variant: "destructive",
      });
    }
  });

  const handleBvnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (bvn.length === 11) {
      verifyBvnMutation.mutate(bvn);
    } else {
      toast({
        title: "Invalid BVN",
        description: "BVN must be 11 digits",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  const getStatusIcon = () => {
    switch (verification?.verification_status) {
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'pending':
        return <AlertCircle className="h-5 w-5 text-warning" />;
      case 'rejected':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Shield className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (verification?.verification_status) {
      case 'approved':
        return 'Verified';
      case 'pending':
        return 'Pending Verification';
      case 'rejected':
        return 'Verification Rejected';
      default:
        return 'Not Verified';
    }
  };

  const getStatusDescription = () => {
    switch (verification?.verification_status) {
      case 'approved':
        return 'Your identity has been successfully verified. You can now access all platform features.';
      case 'pending':
        return 'Your verification is being processed. This usually takes 24-48 hours.';
      case 'rejected':
        return 'Your verification was rejected. Please contact support for assistance.';
      default:
        return 'Complete your KYC verification to access all features and increase your transaction limits.';
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">KYC Verification</h1>
        <p className="text-muted-foreground">
          Verify your identity to access all AjoFlow features
        </p>
      </div>

      <div className="grid gap-6">
        {/* Verification Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon()}
              Verification Status
            </CardTitle>
            <CardDescription>
              Current status of your identity verification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="font-medium">{getStatusText()}</div>
                <p className="text-sm text-muted-foreground">
                  {getStatusDescription()}
                </p>
              </div>
              
              {verification?.verification_status === 'approved' && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your account is fully verified! You can now create and join thrift groups.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        {/* BVN Verification */}
        {verification?.verification_status !== 'approved' && (
          <Card>
            <CardHeader>
              <CardTitle>Bank Verification Number (BVN)</CardTitle>
              <CardDescription>
                Enter your 11-digit BVN to verify your identity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBvnSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bvn">BVN Number</Label>
                  <Input
                    id="bvn"
                    type="text"
                    placeholder="Enter your 11-digit BVN"
                    value={bvn}
                    onChange={(e) => setBvn(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    maxLength={11}
                    disabled={verification?.verification_status === 'pending'}
                  />
                  <p className="text-xs text-muted-foreground">
                    Your BVN is encrypted and stored securely. We use it only for identity verification.
                  </p>
                </div>

                {verification?.verification_status !== 'pending' && (
                  <Button 
                    type="submit" 
                    disabled={bvn.length !== 11 || verifyBvnMutation.isPending}
                    className="w-full"
                  >
                    {verifyBvnMutation.isPending ? 'Submitting...' : 'Verify BVN'}
                  </Button>
                )}
              </form>

              {verification?.verification_status === 'pending' && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your BVN verification is in progress. You'll receive a notification once it's complete.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Document Upload (Future Feature) */}
        <Card className="opacity-75">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Document Upload
              <span className="text-xs bg-muted px-2 py-1 rounded">Coming Soon</span>
            </CardTitle>
            <CardDescription>
              Additional document verification (feature coming soon)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Advanced verification with document upload will be available soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Verification;