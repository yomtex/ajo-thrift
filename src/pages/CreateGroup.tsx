import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Users, Calendar, DollarSign, AlertCircle } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';

const CreateGroup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    contributionAmount: '',
    frequency: '',
    maxParticipants: '',
    startDate: ''
  });

  // Check if user is verified
  const { data: verification, isLoading: verificationLoading } = useQuery({
    queryKey: ['verification', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('verification')
        .select('verification_status')
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const createGroupMutation = useMutation({
    mutationFn: async (groupData: typeof formData) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('thrift_groups')
        .insert({
          name: groupData.name,
          description: groupData.description,
          contribution_amount: parseFloat(groupData.contributionAmount),
          frequency: groupData.frequency as 'weekly' | 'monthly',
          max_participants: parseInt(groupData.maxParticipants),
          start_date: groupData.startDate,
          creator_id: user.id,
          status: 'recruiting'
        })
        .select()
        .single();

      if (error) throw error;
      
      // Automatically join the creator as the first member
      await supabase
        .from('group_members')
        .insert({
          group_id: data.id,
          user_id: user.id,
          payout_position: 1
        });

      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Group Created!",
        description: `"${data.name}" has been created successfully.`,
      });
      navigate('/groups');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create group",
        variant: "destructive",
      });
    }
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name || !formData.contributionAmount || !formData.frequency || 
        !formData.maxParticipants || !formData.startDate) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (parseInt(formData.maxParticipants) < 2 || parseInt(formData.maxParticipants) > 50) {
      toast({
        title: "Invalid Participants",
        description: "Group must have between 2 and 50 participants",
        variant: "destructive",
      });
      return;
    }

    if (parseFloat(formData.contributionAmount) < 1000) {
      toast({
        title: "Invalid Amount",
        description: "Minimum contribution is ₦1,000",
        variant: "destructive",
      });
      return;
    }

    createGroupMutation.mutate(formData);
  };

  if (verificationLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (verification?.verification_status !== 'approved') {
    return (
      <div className="container mx-auto py-6">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/groups')} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Groups
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Create Thrift Group</h1>
        </div>

        <Card className="max-w-2xl">
          <CardContent className="p-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You need to complete KYC verification before creating a group. 
                Please verify your BVN first.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={() => navigate('/verification')}>
                Complete Verification
              </Button>
              <Button variant="ghost" onClick={() => navigate('/groups')}>
                Back to Groups
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/groups')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Groups
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Create Thrift Group</h1>
        <p className="text-muted-foreground">
          Set up a new savings group for your community
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Group Details</CardTitle>
              <CardDescription>
                Provide the basic information for your thrift group
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Group Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Monthly Savers Circle"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the purpose and goals of your group..."
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contribution">Contribution Amount (₦) *</Label>
                    <Input
                      id="contribution"
                      type="number"
                      placeholder="10000"
                      value={formData.contributionAmount}
                      onChange={(e) => handleInputChange('contributionAmount', e.target.value)}
                      min="1000"
                      step="100"
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimum: ₦1,000
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="frequency">Frequency *</Label>
                    <Select 
                      value={formData.frequency} 
                      onValueChange={(value) => handleInputChange('frequency', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg z-50">
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="participants">Maximum Participants *</Label>
                    <Input
                      id="participants"
                      type="number"
                      placeholder="10"
                      value={formData.maxParticipants}
                      onChange={(e) => handleInputChange('maxParticipants', e.target.value)}
                      min="2"
                      max="50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Between 2 and 50 members
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="start-date">Start Date *</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => handleInputChange('startDate', e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button 
                    type="submit" 
                    disabled={createGroupMutation.isPending}
                    className="flex-1"
                  >
                    {createGroupMutation.isPending ? 'Creating Group...' : 'Create Group'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => navigate('/groups')}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Preview</CardTitle>
              <CardDescription>How your group will appear to others</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium">{formData.name || 'Group Name'}</h4>
                <p className="text-sm text-muted-foreground">
                  {formData.description || 'Group description...'}
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">
                      {formData.contributionAmount 
                        ? formatCurrency(parseFloat(formData.contributionAmount))
                        : '₦0'
                      }
                    </div>
                    <div className="text-muted-foreground">
                      per {formData.frequency || 'period'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">
                      1/{formData.maxParticipants || 0} members
                    </div>
                    <div className="text-muted-foreground">participants</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">
                      {formData.startDate 
                        ? new Date(formData.startDate).toLocaleDateString()
                        : 'Start date'
                      }
                    </div>
                    <div className="text-muted-foreground">start date</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Once created, some group details cannot be changed. Please review carefully.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
};

export default CreateGroup;